import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EggRepositorySyncService } from '../egg-repository-sync.service';
import { EggUpdateSettingsService } from './egg-update-settings.service';
import { EGG_UPDATE_INTERVAL_MS } from './egg-update.constants';
import { TYRAVEX_EGGS_INDEX } from '../catalog/egg-source';
import { newerEggVersion } from '../catalog/egg-system-tags';

@Injectable()
export class OfficialEggUpdateService {
  constructor(private readonly prisma: PrismaService, private readonly sync: EggRepositorySyncService, private readonly settings: EggUpdateSettingsService) {}

  async refresh(id: string, automatic = false, canContinue = () => true) {
    const now = new Date(); const lease = new Date(now.getTime() + 10 * 60 * 1000);
    const claim = await this.prisma.eggRepository.updateMany({ where: { id, isOfficial: true, url: TYRAVEX_EGGS_INDEX, status: 'ENABLED', archivedAt: null,
      OR: [{ syncClaimUntil: null }, { syncClaimUntil: { lt: now } }],
      ...(automatic ? { AND: [{ OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - EGG_UPDATE_INTERVAL_MS) } }] }] } : {}),
    }, data: { syncClaimUntil: lease } });
    if (!claim.count) { if (automatic) return { skipped: true }; throw new ConflictException('Official source is disabled, archived, or already being checked'); }
    try {
      const preview = await this.sync.preview(id);
      const latestVersions: Record<string, string> = {};
      for (const entry of preview.entries) {
        if (entry.state === 'INVALID' || entry.state === 'CONFLICT') continue;
        if (!latestVersions[entry.key] || newerEggVersion(entry.version, latestVersions[entry.key])) latestVersions[entry.key] = entry.version;
      }
      const issues = preview.entries.some((entry) => ['INVALID', 'CONFLICT'].includes(entry.state));
      await this.prisma.eggRepository.update({ where: { id }, data: { latestVersions, lastCheckedAt: new Date(), lastSyncError: issues ? 'Some versions are invalid or conflict with imported definitions.' : null } });
      const selected = preview.entries.filter((entry) => entry.state === 'NEW').map((entry) => entry.path);
      let imported = 0;
      const syncAllowed = automatic && canContinue() && await this.settings.enabled();
      if (syncAllowed && selected.length) {
        const result = await this.sync.sync(null, id, selected, preview.digest, true); imported = result.imported;
      }
      if (syncAllowed) await this.prisma.eggRepository.update({ where: { id }, data: { lastSyncAt: new Date() } });
      return { checked: preview.entries.length, imported, issues };
    } catch (error) {
      await this.prisma.eggRepository.update({ where: { id }, data: { lastCheckedAt: new Date(), lastSyncError: 'Official catalog check failed. Existing definitions were preserved.' } });
      throw error;
    } finally {
      await this.prisma.eggRepository.updateMany({ where: { id, syncClaimUntil: lease }, data: { syncClaimUntil: null } });
    }
  }
  async tick(canContinue = () => true) {
    if (!canContinue() || !await this.settings.enabled()) return;
    const sources = await this.prisma.eggRepository.findMany({ where: { isOfficial: true, url: TYRAVEX_EGGS_INDEX, status: 'ENABLED', archivedAt: null }, select: { id: true } });
    for (const source of sources) { if (!canContinue()) return; await this.refresh(source.id, true, canContinue); }
  }
}
