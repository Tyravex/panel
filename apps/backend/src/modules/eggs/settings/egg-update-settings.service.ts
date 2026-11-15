import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OFFICIAL_EGG_AUTO_UPDATE_KEY, EGG_UPDATE_INTERVAL_MS } from './egg-update.constants';
import { TYRAVEX_EGGS_INDEX } from '../catalog/egg-source';

@Injectable()
export class EggUpdateSettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async enabled() {
    const row = await this.prisma.panelSetting.findUnique({ where: { key: OFFICIAL_EGG_AUTO_UPDATE_KEY }, select: { booleanValue: true } });
    return row?.booleanValue === true;
  }
  async get() {
    const enabled = await this.enabled();
    const repositories = await this.prisma.eggRepository.findMany({ where: { isOfficial: true, archivedAt: null, url: TYRAVEX_EGGS_INDEX },
      select: { id: true, name: true, status: true, lastCheckedAt: true, lastSyncAt: true, lastSyncError: true } });
    return { enabled, intervalHours: EGG_UPDATE_INTERVAL_MS / 3600000, repositories };
  }
  async update(actorId: number, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof (input as { enabled?: unknown }).enabled !== 'boolean') throw new BadRequestException('Expected enabled boolean only');
    const enabled = (input as { enabled: boolean }).enabled;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(847205, 1)::text`;
      const previous = await tx.panelSetting.findUnique({ where: { key: OFFICIAL_EGG_AUTO_UPDATE_KEY }, select: { booleanValue: true } });
      await tx.panelSetting.upsert({ where: { key: OFFICIAL_EGG_AUTO_UPDATE_KEY }, create: { key: OFFICIAL_EGG_AUTO_UPDATE_KEY, booleanValue: enabled }, update: { booleanValue: enabled } });
      await tx.adminAuditLog.create({ data: { actorId, action: 'OFFICIAL_EGG_AUTO_UPDATE_CHANGED', targetType: 'PANEL_SETTING', targetId: OFFICIAL_EGG_AUTO_UPDATE_KEY, metadata: { previous: previous?.booleanValue ?? false, enabled } } });
    });
    return this.get();
  }
}
