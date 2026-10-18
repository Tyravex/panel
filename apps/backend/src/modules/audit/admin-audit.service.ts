import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    rawPage?: string,
    rawAction?: string,
    rawActorId?: string,
  ) {
    const page = rawPage === undefined ? 1 : Number(rawPage);

    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
      throw new BadRequestException('Invalid page');
    }

    const action = rawAction?.trim();
    if (action && !/^[A-Z_]{3,64}$/.test(action)) {
      throw new BadRequestException('Invalid action');
    }

    const actorId = rawActorId === undefined
      ? undefined
      : Number(rawActorId);

    if (
      actorId !== undefined &&
      (!Number.isSafeInteger(actorId) || actorId <= 0)
    ) {
      throw new BadRequestException('Invalid actor ID');
    }

    const where: Prisma.AdminAuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(actorId !== undefined ? { actorId } : {}),
    };

    const limit = 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.count({ where }),
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actorId: true,
          actor: {
            select: { id: true, username: true },
          },
          action: true,
          targetType: true,
          targetId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}