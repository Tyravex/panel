import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { validateEggManifest } from '../eggs/egg-manifest.validator';

import { CreateServiceDto } from './dto/create-service.dto';
import { SetServiceOwnerDto } from './dto/set-service-owner.dto';
import {
  SetServiceMemberDto,
  UpdateServiceMemberDto,
} from './dto/service-member.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) { }

  async getUserServices(userId: number) {
    return this.prisma.service.findMany({
      where: { userId },
      include: {
        category: { select: { key: true, name: true } },
        server: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserService(serviceId: string, userId: number) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, userId },
      include: {
        category: { select: { key: true, name: true } },
        server: { select: { id: true, status: true } },
        egg: {
          select: {
            id: true,
            key: true,
            name: true,
            version: true,
            isEnabled: true,
            repository: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async getAllServices() {
    return this.prisma.service.findMany({
      include: {
        category: { select: { key: true, name: true } },
        user: { select: { id: true, username: true } },
        server: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAvailableEggs() {
    return this.prisma.egg.findMany({
      where: {
        isEnabled: true,
        repository: {
          status: 'ENABLED',
        },
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        version: true,
        manifest: true,
        repository: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { name: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  async assignEgg(
    serviceId: string,
    userId: number,
    eggId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Service"
        WHERE "id" = ${serviceId}
          AND "userId" = ${userId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException('Service not found');
      }

      const service = await tx.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          eggId: true,
          installStatus: true,
          category: {
            select: { key: true },
          },
        },
      });

      if (!service) {
        throw new NotFoundException('Service not found');
      }

      if (service.installStatus !== 'DRAFT') {
        throw new ConflictException(
          'Egg can only be assigned to a draft service',
        );
      }

      const eggReference = await tx.egg.findUnique({
        where: { id: eggId },
        select: { repositoryId: true },
      });

      if (!eggReference) {
        throw new NotFoundException('Egg not found');
      }

      // Coordinate with repository status changes.
      const repositoryLock = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "EggRepository"
        WHERE "id" = ${eggReference.repositoryId}
        FOR UPDATE
      `;

      if (repositoryLock.length === 0) {
        throw new NotFoundException('Egg repository not found');
      }

      const egg = await tx.egg.findUnique({
        where: { id: eggId },
        select: {
          id: true,
          key: true,
          name: true,
          version: true,
          isEnabled: true,
          manifest: true,
          repository: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!egg) {
        throw new NotFoundException('Egg not found');
      }

      if (
        !egg.isEnabled ||
        egg.repository.status !== 'ENABLED'
      ) {
        throw new ConflictException(
          'Egg or its repository is disabled',
        );
      }

      const manifest = egg.manifest;

      if (
        typeof manifest !== 'object' ||
        manifest === null ||
        Array.isArray(manifest) ||
        !('category' in manifest) ||
        manifest.category !== service.category.key
      ) {
        throw new BadRequestException(
          'Egg category does not match service category',
        );
      }

      if (service.eggId === egg.id) {
        return {
          serviceId: service.id,
          eggId: egg.id,
          egg: {
            id: egg.id,
            key: egg.key,
            name: egg.name,
            version: egg.version,
          },
        };
      }

      const updated = await tx.service.update({
        where: { id: serviceId },
        data: { eggId: egg.id },
        select: {
          id: true,
          eggId: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: userId,
          action: 'SERVICE_EGG_ASSIGNED',
          targetType: 'SERVICE',
          targetId: serviceId,
          metadata: {
            previousEggId: service.eggId,
            eggId: egg.id,
          },
        },
      });

      return {
        serviceId: updated.id,
        eggId: updated.eggId,
        egg: {
          id: egg.id,
          key: egg.key,
          name: egg.name,
          version: egg.version,
        },
      };
    });
  }

  async prepareInstall(serviceId: string, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Prevent concurrent changes to the same service.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Service"
        WHERE "id" = ${serviceId}
          AND "userId" = ${userId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException('Service not found');
      }

      const service = await tx.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          eggId: true,
          dockerImage: true,
          installStatus: true,
          category: {
            select: { key: true },
          },
        },
      });

      if (!service) {
        throw new NotFoundException('Service not found');
      }

      if (
        service.installStatus !== 'DRAFT' &&
        service.installStatus !== 'FAILED'
      ) {
        throw new ConflictException(
          'Service is not ready for installation preparation',
        );
      }

      if (!service.eggId) {
        throw new BadRequestException(
          'Service has no assigned egg',
        );
      }

      const eggReference = await tx.egg.findUnique({
        where: { id: service.eggId },
        select: { repositoryId: true },
      });

      if (!eggReference) {
        throw new NotFoundException('Egg not found');
      }

      // Use the same lock order as egg assignment and job creation:
      // Service -> EggRepository.
      const repositoryLock = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "EggRepository"
        WHERE "id" = ${eggReference.repositoryId}
        FOR UPDATE
      `;

      if (repositoryLock.length === 0) {
        throw new NotFoundException(
          'Egg repository not found',
        );
      }

      const egg = await tx.egg.findUnique({
        where: { id: service.eggId },
        select: {
          id: true,
          key: true,
          version: true,
          isEnabled: true,
          manifest: true,
          repository: {
            select: { status: true },
          },
        },
      });

      if (!egg) {
        throw new NotFoundException('Egg not found');
      }

      if (
        !egg.isEnabled ||
        egg.repository.status !== 'ENABLED'
      ) {
        throw new ConflictException(
          'Egg or its repository is disabled',
        );
      }

      // Revalidate stored data before using it as runtime configuration.
      const validated = validateEggManifest(egg.manifest);

      const manifest = validated.manifest as {
        category: string;
        runtime: {
          image: string;
          startup: string;
        };
      };

      if (manifest.category !== service.category.key) {
        throw new BadRequestException(
          'Egg category does not match service category',
        );
      }

      if (
        validated.key !== egg.key ||
        validated.version !== egg.version
      ) {
        throw new BadRequestException(
          'Egg metadata does not match its manifest',
        );
      }

      const image = manifest.runtime.image.trim();

      const existingJob = await tx.job.findFirst({
        where: {
          serviceId,
          type: 'INSTALL',
          status: {
            in: [
              'PENDING',
              'DISPATCHING',
              'QUEUED',
              'RUNNING',
            ],
          },
        },
        select: { id: true },
      });

      if (existingJob) {
        throw new ConflictException(
          'An installation job already exists',
        );
      }

      // Idempotent preparation: avoid unnecessary writes and audit logs.
      if (service.dockerImage === image) {
        return {
          serviceId: service.id,
          eggId: egg.id,
          eggVersion: egg.version,
          dockerImage: image,
          prepared: true,
          changed: false,
        };
      }

      await tx.service.update({
        where: { id: serviceId },
        data: { dockerImage: image },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId: userId,
          action: 'SERVICE_INSTALL_PREPARED',
          targetType: 'SERVICE',
          targetId: serviceId,
          metadata: {
            eggId: egg.id,
            eggVersion: egg.version,
            dockerImage: image,
          },
        },
      });

      return {
        serviceId: service.id,
        eggId: egg.id,
        eggVersion: egg.version,
        dockerImage: image,
        prepared: true,
        changed: true,
      };
    });
  }

  async createService(actorId: number, dto: CreateServiceDto) {
    const name = dto.name.trim();
    const categoryKey = dto.categoryKey.trim();

    if (!name || !categoryKey) {
      throw new BadRequestException(
        'Name and category are required',
      );
    }

    const category = await this.prisma.serviceCategory.findUnique({
      where: { key: categoryKey },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Unknown service category');
    }

    if (dto.nodeId !== undefined) {
      const node = await this.prisma.node.findUnique({
        where: { id: dto.nodeId },
        select: { id: true },
      });

      if (!node) {
        throw new BadRequestException('Unknown node');
      }
    }

    const ownerId = dto.userId ?? null;

    if (ownerId !== null) {
      await this.assertActiveUser(ownerId);
    }

    // Persist the draft and audit record atomically.
    // No Docker operation runs here.
    return this.prisma.$transaction(async (tx) => {
      const service = await tx.service.create({
        data: {
          name,
          userId: ownerId,
          categoryId: category.id,
          nodeId: dto.nodeId,
          memoryMb: dto.memoryMb,
          cpuPercent: dto.cpuPercent,
          diskMb: dto.diskMb,
          installStatus: 'DRAFT',
        },
        select: {
          id: true,
          name: true,
          userId: true,
          categoryId: true,
          nodeId: true,
          memoryMb: true,
          cpuPercent: true,
          diskMb: true,
          installStatus: true,
          createdAt: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'SERVICE_CREATED',
          targetType: 'SERVICE',
          targetId: service.id,
          metadata: { ownerId, categoryKey },
        },
      });

      return service;
    });
  }

  async setOwner(
    serviceId: string,
    actorId: number,
    dto: SetServiceOwnerDto,
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(dto, 'userId') ||
      dto.userId === undefined
    ) {
      throw new BadRequestException(
        'userId is required (number or null)',
      );
    }

    const ownerId = dto.userId;

    if (ownerId !== null) {
      if (
        !Number.isSafeInteger(ownerId) ||
        ownerId <= 0
      ) {
        throw new BadRequestException('Invalid owner ID');
      }

      await this.assertActiveUser(ownerId);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.service.findUnique({
        where: { id: serviceId },
        select: { id: true, userId: true },
      });

      if (!existing) {
        throw new NotFoundException('Service not found');
      }

      if (existing.userId === ownerId) {
        return existing;
      }

      const updated = await tx.service.update({
        where: { id: serviceId },
        data: { userId: ownerId },
        select: { id: true, userId: true },
      });

      if (ownerId !== null) {
        await tx.serviceMember.deleteMany({
          where: { serviceId, userId: ownerId },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'SERVICE_OWNER_CHANGED',
          targetType: 'SERVICE',
          targetId: serviceId,
          metadata: {
            previousOwnerId: existing.userId,
            ownerId,
          },
        },
      });

      return updated;
    });
  }

  private async assertActiveUser(userId: number): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Active user not found');
    }
  }

  private async assertOwner(
    serviceId: string,
    ownerId: number,
  ): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, userId: ownerId },
      select: { id: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }
  }

  async getMembers(serviceId: string, ownerId: number) {
    await this.assertOwner(serviceId, ownerId);

    return this.prisma.serviceMember.findMany({
      where: { serviceId },
      select: {
        userId: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(
    serviceId: string,
    ownerId: number,
    dto: SetServiceMemberDto,
  ) {
    await this.assertOwner(serviceId, ownerId);

    if (dto.userId === ownerId) {
      throw new BadRequestException(
        'The service owner cannot be added as a member',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, isActive: true },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.serviceMember.findUnique({
      where: {
        serviceId_userId: {
          serviceId,
          userId: dto.userId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'User is already a service member',
      );
    }

    try {
      return await this.prisma.serviceMember.create({
        data: {
          serviceId,
          userId: dto.userId,
          permissions: dto.permissions,
        },
        select: {
          userId: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'User is already a service member',
        );
      }

      throw error;
    }
  }

  async updateMember(
    serviceId: string,
    ownerId: number,
    memberUserId: number,
    dto: UpdateServiceMemberDto,
  ) {
    await this.assertOwner(serviceId, ownerId);

    const member = await this.prisma.serviceMember.findUnique({
      where: {
        serviceId_userId: {
          serviceId,
          userId: memberUserId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      throw new NotFoundException(
        'Service member not found',
      );
    }

    return this.prisma.serviceMember.update({
      where: { id: member.id },
      data: { permissions: dto.permissions },
      select: {
        userId: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async removeMember(
    serviceId: string,
    ownerId: number,
    memberUserId: number,
  ) {
    await this.assertOwner(serviceId, ownerId);

    const result = await this.prisma.serviceMember.deleteMany({
      where: { serviceId, userId: memberUserId },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Service member not found',
      );
    }

    return { removed: true };
  }
}
