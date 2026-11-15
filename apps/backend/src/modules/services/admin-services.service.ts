import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { validateEggManifest } from '../eggs/egg-manifest.validator';
import { CreateAdminServiceDto, UpdateAdminServiceDto } from './dto/admin-service.dto';
import { resolveEggSelection } from '../eggs/catalog/egg-catalog-options';
import type { EggManifest } from '@shared/types';

const include = { category: true, user: { select: { id: true, username: true } }, egg: true } as const;

@Injectable()
export class AdminServicesService {
  constructor(private readonly prisma: PrismaService) {}

  list() { return this.prisma.service.findMany({ include, orderBy: { createdAt: 'desc' } }); }
  async get(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id }, include: { ...include, eggConfiguration: { select: { profileId: true, runtimeVersion: true } } } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async save(actorId: number, input: CreateAdminServiceDto | UpdateAdminServiceDto, id?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (id) await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${id} FOR UPDATE`;
      const previous = id ? await tx.service.findUnique({ where: { id }, include: { category: true, eggConfiguration: { select: { profileId: true, runtimeVersion: true } } } }) : null;
      if (id && !previous) throw new NotFoundException('Service not found');
      if (previous && previous.installStatus !== 'DRAFT') throw new ConflictException('Only draft service configuration can be edited');
      if (previous && 'expectedUpdatedAt' in input && input.expectedUpdatedAt && previous.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        throw new ConflictException('Service changed; reload before saving');
      }
      if (id && await tx.job.findFirst({ where: { serviceId: id, type: 'INSTALL', status: { in: ['PENDING', 'DISPATCHING', 'QUEUED', 'RUNNING'] } }, select: { id: true } })) throw new ConflictException('Service configuration is locked by an active installation');
      const name = input.name?.trim() ?? previous?.name;
      const categoryKey = input.categoryKey ?? previous?.category.key;
      if (!name || name.length > 100 || !categoryKey) throw new BadRequestException('Name and category are required');
      const category = await tx.serviceCategory.findUnique({ where: { key: categoryKey } });
      if (!category) throw new BadRequestException('Unknown service category');
      const nodeId = input.nodeId !== undefined ? input.nodeId : previous?.nodeId ?? null;
      if (nodeId && !await tx.node.findUnique({ where: { id: nodeId }, select: { id: true } })) throw new BadRequestException('Unknown node');
      const ownerId = !id && 'userId' in input ? input.userId ?? null : previous?.userId ?? null;
      if (ownerId !== null && !await tx.user.findFirst({ where: { id: ownerId, isActive: true }, select: { id: true } })) {
        throw new BadRequestException('Unknown active owner');
      }
      const eggId = input.eggId !== undefined ? input.eggId : previous?.eggId ?? null;
      let defaults: { memoryMb: number; cpuPercent: number; diskMb: number } | undefined;
      let dockerImage: string | null = null;
      let selection: { profileId: string | null; runtimeVersion: string | null } | null = null;
      if (eggId) {
        const reference = await tx.egg.findUnique({ where: { id: eggId }, select: { repositoryId: true } });
        if (!reference) throw new BadRequestException('Unknown Egg');
        await tx.$queryRaw`SELECT "id" FROM "EggRepository" WHERE "id" = ${reference.repositoryId} FOR UPDATE`;
        const egg = await tx.egg.findUnique({ where: { id: eggId }, include: { repository: true } });
        if (!egg || !egg.isEnabled || egg.approvalStatus !== 'APPROVED' || egg.repository.status !== 'ENABLED') {
          throw new ConflictException('Egg must be approved, enabled and in an enabled repository');
        }
        const validated = validateEggManifest(egg.manifest);
        const manifest = validated.manifest as unknown as { category: string; runtime: { image: string }; resources: typeof defaults };
        if (manifest.category !== categoryKey || validated.key !== egg.key || validated.version !== egg.version) {
          throw new BadRequestException('Egg is incompatible with the service');
        }
        defaults = manifest.resources;
        const sameEgg = previous?.eggId === eggId;
        const resolved = resolveEggSelection(egg.manifest as unknown as EggManifest, {
          profileId: input.profileId ?? (sameEgg ? previous?.eggConfiguration?.profileId ?? undefined : undefined),
          runtimeVersion: input.runtimeVersion ?? (sameEgg ? previous?.eggConfiguration?.runtimeVersion ?? undefined : undefined),
        });
        dockerImage = resolved.image.trim();
        if ((egg.manifest as unknown as EggManifest).catalog) selection = { profileId: resolved.profileId, runtimeVersion: resolved.runtimeVersion };
      }
      const resources = {
        memoryMb: input.memoryMb ?? previous?.memoryMb ?? defaults?.memoryMb ?? null,
        cpuPercent: input.cpuPercent ?? previous?.cpuPercent ?? defaults?.cpuPercent ?? null,
        diskMb: input.diskMb ?? previous?.diskMb ?? defaults?.diskMb ?? null,
      };
      for (const [key, value] of Object.entries(resources)) {
        const maximum = key === 'memoryMb' ? 1048576 : key === 'cpuPercent' ? 100 : 10485760;
        if (value !== null && (!Number.isSafeInteger(value) || value < 1 || value > maximum)) throw new BadRequestException('Invalid resource limits');
      }
      const data = { name, categoryId: category.id, nodeId, eggId, dockerImage, ...resources };
      const service = id ? await tx.service.update({ where: { id }, data, include })
        : await tx.service.create({ data: { ...data, userId: ownerId, installStatus: 'DRAFT' }, include });
      if (id && previous?.eggId !== eggId) await tx.serviceEggConfiguration.deleteMany({ where: { serviceId: id } });
      if (selection) await tx.serviceEggConfiguration.upsert({ where: { serviceId: service.id }, create: { serviceId: service.id, ...selection }, update: selection });
      await tx.adminAuditLog.create({ data: { actorId, action: id ? 'SERVICE_UPDATED' : 'SERVICE_CREATED',
        targetType: 'SERVICE', targetId: service.id, metadata: { eggId, categoryKey, nodeId } as Prisma.InputJsonObject } });
      return { ...service, eggConfiguration: selection };
    });
  }
}
