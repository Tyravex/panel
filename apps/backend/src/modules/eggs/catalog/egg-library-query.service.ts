import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EggManifest } from '@shared/types';
import { PrismaService } from '@/prisma/prisma.service';
import { inferSystemEggTags, newerEggVersion, systemTagFilter } from './egg-system-tags';
import { visibleEggTagWhere } from './egg-tags.service';
import { record } from './egg-catalog-options';

@Injectable()
export class EggLibraryQueryService {
  constructor(private readonly prisma: PrismaService) {}
  async list(userId: number, options: { query?: string; page?: string; category?: string; tag?: string }) {
    if (Object.entries(options).some(([key, value]) => !['query', 'page', 'category', 'tag'].includes(key) || (value !== undefined && typeof value !== 'string'))) throw new BadRequestException('Invalid catalog filters');
    if (options.page !== undefined && !/^[1-9]\d*$/.test(options.page)) throw new BadRequestException('Invalid catalog page');
    const page = options.page === undefined ? 1 : Number(options.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || (options.query?.length ?? 0) > 100 || (options.tag?.length ?? 0) > 100) throw new BadRequestException('Invalid catalog filters');
    if (options.category && !['server', 'discord_bot', 'telegram_bot', 'other'].includes(options.category)) throw new BadRequestException('Unknown Egg category');
    const filters: Prisma.EggWhereInput[] = [{ repository: { archivedAt: null } }];
    if (options.query?.trim()) filters.push({ OR: ['key', 'name', 'description'].map((key) => ({ [key]: { contains: options.query!.trim(), mode: 'insensitive' } })) });
    if (options.category) filters.push({ manifest: { path: ['category'], equals: options.category } });
    if (options.tag) {
      const system = systemTagFilter(options.tag);
      if (options.tag.startsWith('system:') && !system) throw new BadRequestException('Unknown system tag');
      filters.push(system ?? { tagAssignments: { some: { tagId: options.tag, tag: visibleEggTagWhere(userId) } } });
    }
    const where: Prisma.EggWhereInput = { AND: filters };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.egg.count({ where }),
      this.prisma.egg.findMany({ where, orderBy: [{ name: 'asc' }, { createdAt: 'desc' }], skip: (page - 1) * 20, take: 20,
        include: { repository: { select: { id: true, name: true, isOfficial: true, archivedAt: true, latestVersions: true } },
          tagAssignments: { where: { tag: visibleEggTagWhere(userId) }, include: { tag: true } }, _count: { select: { services: true } } } }),
    ]);
    const items = rows.map(({ manifest, repository, tagAssignments, _count, provenance: _provenance, ...egg }) => {
      const parsed = manifest as unknown as EggManifest;
      const versions = record(repository.latestVersions) ? repository.latestVersions : {};
      const candidate = typeof versions[egg.key] === 'string' ? versions[egg.key] as string : null;
      const { latestVersions: _cache, ...source } = repository;
      return { ...egg, repository: source, category: parsed.category,
        latestVersion: candidate && newerEggVersion(candidate, egg.version) ? candidate : null,
        tags: [...inferSystemEggTags(egg.key, egg.name, parsed), ...tagAssignments.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color, ownerId: tag.ownerId, system: false }))], serviceCount: _count.services };
    });
    const totalPages = Math.ceil(total / 20);
    return { items, pagination: { page, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 && totalPages > 0 } };
  }
}
