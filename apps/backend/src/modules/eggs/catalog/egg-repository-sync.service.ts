import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RemoteJsonService } from '@/infrastructure/http/remote-json.service';
import { isSafeCommunityHttpsUrl } from '@/infrastructure/http/public-url';
import { validateEggManifest } from '../egg-manifest.validator';
import { adaptRepositoryEgg } from './egg-repository.adapter';
import { eggDigest, pinEggSource } from './egg-source';
import { record } from './egg-catalog-options';
import type { EggRepositoryPreview } from '@shared/types';
import { OFFICIAL_EGG_AUTO_UPDATE_KEY } from '../settings/egg-update.constants';
import { TYRAVEX_EGGS_INDEX } from './egg-source';

@Injectable()
export class EggRepositorySyncService {
  constructor(private readonly prisma: PrismaService, private readonly remote: RemoteJsonService) {}

  async preview(repositoryId: string): Promise<EggRepositoryPreview> {
    const repository = await this.prisma.eggRepository.findUnique({ where: { id: repositoryId } });
    if (!repository) throw new NotFoundException('Repository not found');
    if (repository.status !== 'ENABLED' || repository.archivedAt) throw new ConflictException('Enable an active repository before synchronization');
    const source = await pinEggSource(repository.url, this.remote);
    const raw = await this.remote.getJson(source.url);
    if (!record(raw) || raw.schemaVersion !== 1 || (raw.format !== undefined && raw.format !== 'tyravex-egg-repository') || !Array.isArray(raw.eggs) || raw.eggs.length > 50) throw new BadRequestException('Expected repository schemaVersion 1 with at most 50 Egg entries');
    const paths = raw.eggs.map((entry: unknown) => {
      const path = typeof entry === 'string' ? entry : record(entry) ? entry.path : undefined;
      if (typeof path !== 'string' || !path.endsWith('.json') || path.length > 300 || path.includes('\\') || path.split('/').includes('..')) throw new BadRequestException('Invalid Egg path');
      if (source.commit && !/^[A-Za-z0-9_./-]+\.json$/.test(path)) throw new BadRequestException('Use a relative path inside the pinned GitHub repository');
      let url: URL;
      try { url = new URL(path, source.url); } catch { throw new BadRequestException('Invalid Egg path'); }
      if (url.origin !== new URL(source.url).origin || !isSafeCommunityHttpsUrl(url.href)) throw new BadRequestException('Egg paths must use the repository origin');
      if (source.commit && !url.pathname.startsWith(new URL(source.url).pathname.split('/').slice(0, 4).join('/') + '/')) throw new BadRequestException('Egg path escapes the pinned repository');
      return { path, url: url.href, metadata: record(entry) ? entry : null };
    });
    if (new Set(paths.map((entry) => entry.url)).size !== paths.length) throw new BadRequestException('Duplicate Egg paths');
    const entries: EggRepositoryPreview['entries'] = [];
    for (let offset = 0; offset < paths.length; offset += 4) {
      const chunk = await Promise.all(paths.slice(offset, offset + 4).map(async (entry): Promise<EggRepositoryPreview['entries'][number]> => {
        let original: unknown;
        let manifest: ReturnType<typeof adaptRepositoryEgg>;
        let parsed: ReturnType<typeof validateEggManifest>;
        try {
          original = await this.remote.getJson(entry.url);
          manifest = adaptRepositoryEgg(original);
          parsed = validateEggManifest(manifest);
          if (entry.metadata && (entry.metadata.id !== parsed.key || entry.metadata.version !== parsed.version || entry.metadata.name !== parsed.name || (record(original) && entry.metadata.category !== original.category))) throw new BadRequestException('Index metadata does not match the Egg manifest');
        } catch {
          return { path: entry.path, manifest: null, key: typeof entry.metadata?.id === 'string' ? entry.metadata.id : entry.path, version: '', state: 'INVALID', error: 'Manifest is unavailable, invalid, or incompatible with the supported repository contract.' };
        }
        const existing = await this.prisma.egg.findFirst({ where: { repositoryId, key: parsed.key, version: parsed.version } });
        return { path: entry.path, manifest, key: parsed.key, version: parsed.version, sha256: eggDigest(original), sourceUrl: entry.url,
          state: existing ? eggDigest(existing.manifest) === eggDigest(manifest) ? 'EXISTS' : 'CONFLICT' : 'NEW' };
      }));
      entries.push(...chunk);
    }
    const identities = entries.filter((entry) => entry.state !== 'INVALID').map((entry) => `${entry.key}@${entry.version}`);
    if (new Set(identities).size !== identities.length) throw new BadRequestException('Duplicate Egg identity and version in repository');
    return { repositoryId, entries, commit: source.commit, digest: eggDigest({ repositoryId, url: repository.url, commit: source.commit, entries }) };
  }

  async sync(actorId: number | null, repositoryId: string, selected: string[], expectedDigest?: string, automatic = false) {
    if (!Array.isArray(selected) || !selected.length || selected.length > 50 || selected.some((path) => typeof path !== 'string') || new Set(selected).size !== selected.length) throw new BadRequestException('Select unique Egg paths');
    if (!expectedDigest || !/^[a-f0-9]{64}$/.test(expectedDigest)) throw new BadRequestException('Preview the repository before importing');
    const preview = await this.preview(repositoryId);
    if (preview.digest !== expectedDigest) throw new ConflictException('Repository changed after preview; review the current catalog');
    const entries = selected.map((path) => {
      const entry = preview.entries.find((candidate) => candidate.path === path);
      if (!entry) throw new BadRequestException('Egg path is not in the current repository index');
      return entry;
    });
    if (entries.some((entry) => entry.state === 'CONFLICT' || entry.state === 'INVALID')) throw new ConflictException('Selected versions are conflicting or invalid');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "EggRepository" WHERE "id" = ${repositoryId} FOR UPDATE`;
      const repository = await tx.eggRepository.findUnique({ where: { id: repositoryId } });
      if (!repository || repository.status !== 'ENABLED' || repository.archivedAt) throw new ConflictException('Repository is unavailable');
      if (automatic) {
        await tx.$queryRaw`SELECT "key" FROM "PanelSetting" WHERE "key" = ${OFFICIAL_EGG_AUTO_UPDATE_KEY} FOR SHARE`;
        const setting = await tx.panelSetting.findUnique({ where: { key: OFFICIAL_EGG_AUTO_UPDATE_KEY }, select: { booleanValue: true } });
        if (!setting?.booleanValue || !repository.isOfficial || repository.url !== TYRAVEX_EGGS_INDEX) throw new ConflictException('Automatic updates are disabled or the source is not official');
      }
      if (eggDigest({ repositoryId, url: repository.url, commit: preview.commit, entries: preview.entries }) !== expectedDigest) throw new ConflictException('Repository source changed after preview');
      let imported = 0;
      for (const entry of entries) {
        const parsed = validateEggManifest(entry.manifest);
        const existing = await tx.egg.findFirst({ where: { repositoryId, key: parsed.key, version: parsed.version } });
        if (existing) {
          if (eggDigest(existing.manifest) !== eggDigest(entry.manifest)) throw new ConflictException('Egg version conflict');
          continue;
        }
        await tx.egg.create({ data: { repositoryId, key: parsed.key, name: parsed.name, version: parsed.version,
          description: parsed.description, manifest: parsed.manifest, sourceType: repository.isOfficial && repository.url === TYRAVEX_EGGS_INDEX ? 'OFFICIAL' : 'COMMUNITY', approvalStatus: 'PENDING', isEnabled: false,
          provenance: { url: entry.sourceUrl!, path: entry.path, commit: preview.commit, sha256: entry.sha256!, importedAt: new Date().toISOString() } } });
        imported++;
      }
      await tx.adminAuditLog.create({ data: { actorId, action: 'EGG_REPOSITORY_SYNCED', targetType: 'EGG_REPOSITORY', targetId: repositoryId, metadata: { imported, selected, commit: preview.commit, digest: preview.digest } } });
      return { imported, skipped: entries.length - imported };
    });
  }
}
