import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export const DEFAULT_RBAC_SETTINGS_ID = 1;

export interface DefaultRoleResult {
  id: string;
  name: string;
}

@Injectable()
export class DefaultRoleService {
  constructor(private readonly prisma: PrismaService) { }

  async listEligibleDefaultRoles(): Promise<DefaultRoleResult[]> {
    return this.prisma.role.findMany({
      where: {
        NOT: {
          name: {
            equals: 'Owner',
            mode: 'insensitive',
          },
        },
        permissions: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
  async getDefaultRole(): Promise<DefaultRoleResult> {
    const settings = await this.prisma.rbacSettings.findUnique({
      where: { id: DEFAULT_RBAC_SETTINGS_ID },
      select: {
        defaultRole: {
          select: { id: true, name: true },
        },
      },
    });

    if (!settings) {
      throw new ServiceUnavailableException(
        'Default role is not configured',
      );
    }

    return settings.defaultRole;
  }

  async setDefaultRole(
    roleId: string,
    actorId: number,
  ): Promise<DefaultRoleResult> {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      throw new BadRequestException('Invalid default role ID');
    }

    if (!Number.isSafeInteger(actorId) || actorId <= 0) {
      throw new BadRequestException('Invalid administrator ID');
    }

    return this.prisma.$transaction(async (tx) => {
      // Serialize with RBAC role edits and deletions.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(847201, 1)::text
      `;

      const role = await tx.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          name: true,
          permissions: {
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      if (role.name.toLowerCase() === 'owner') {
        throw new BadRequestException(
          'Owner cannot be the default role',
        );
      }

      if (role.permissions.length !== 0) {
        throw new BadRequestException(
          'Default role must have no global permissions',
        );
      }

      const previous = await tx.rbacSettings.findUnique({
        where: { id: DEFAULT_RBAC_SETTINGS_ID },
        select: { defaultRoleId: true },
      });

      if (previous?.defaultRoleId === role.id) {
        return { id: role.id, name: role.name };
      }

      try {
        await tx.rbacSettings.upsert({
          where: { id: DEFAULT_RBAC_SETTINGS_ID },
          create: {
            id: DEFAULT_RBAC_SETTINGS_ID,
            defaultRoleId: role.id,
          },
          update: {
            defaultRoleId: role.id,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          throw new ConflictException(
            'Selected default role is no longer available',
          );
        }

        throw error;
      }

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'DEFAULT_ROLE_CHANGED',
          targetType: 'PANEL_SETTING',
          targetId: 'rbac:defaultRoleId',
          metadata: {
            previousRoleId: previous?.defaultRoleId ?? null,
            defaultRoleId: role.id,
          },
        },
      });

      return { id: role.id, name: role.name };
    });
  }
}