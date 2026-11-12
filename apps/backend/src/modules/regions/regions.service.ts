import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) { }

  findAll() {
    return this.prisma.region.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            locations: true,
            nodes: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async findById(id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            locations: true,
            nodes: true,
          },
        },
      },
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    return region;
  }

  async deleteRegion(actorId: number, id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Prevent concurrent updates or deletions of this region.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Region"
          WHERE "id" = ${id}
          FOR UPDATE
        `;

        const existing = await tx.region.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                locations: true,
                nodes: true,
              },
            },
          },
        });

        if (!existing) {
          throw new NotFoundException('Region not found');
        }

        if (
          existing._count.locations > 0 ||
          existing._count.nodes > 0
        ) {
          throw new ConflictException(
            'Cannot delete region with assigned locations or nodes',
          );
        }

        await tx.region.delete({
          where: { id },
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'REGION_DELETED',
            targetType: 'REGION',
            targetId: id,
            metadata: {
              name: existing.name,
              code: existing.code,
              description: existing.description,
            },
          },
        });

        return { success: true };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete region with assigned locations or nodes',
        );
      }

      throw error;
    }
  }
  async updateRegion(actorId: number, id: string, dto: UpdateRegionDto) {
    const data: {
      name?: string;
      code?: string;
      description?: string | null;
    } = {};

    if (dto.name !== undefined) {
      if (typeof dto.name !== 'string') {
        throw new BadRequestException('Invalid region name');
      }
      const name = dto.name.trim();
      if (!name || name.length > 100) {
        throw new BadRequestException('Invalid region name');
      }
      data.name = name;
    }

    if (dto.code !== undefined) {
      if (typeof dto.code !== 'string') {
        throw new BadRequestException('Invalid region code');
      }
      const code = dto.code.trim();
      if (
        code.length < 2 ||
        code.length > 50 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)
      ) {
        throw new BadRequestException('Invalid region code');
      }
      data.code = code;
    }

    if (dto.description !== undefined) {
      if (dto.description !== null && typeof dto.description !== 'string') {
        throw new BadRequestException('Invalid region description');
      }
      if (dto.description !== null && dto.description.length > 500) {
        throw new BadRequestException('Invalid region description');
      }
      data.description = dto.description?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No region fields to update');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent updates to the same region.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Region"
          WHERE "id" = ${id}
          FOR UPDATE
        `;

        const existing = await tx.region.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException('Region not found');
        }

        const changes = Object.fromEntries(
          Object.entries(data).filter(
            ([key, value]) =>
              existing[key as keyof typeof existing] !== value,
          ),
        );

        if (Object.keys(changes).length === 0) {
          return existing;
        }

        const updated = await tx.region.update({
          where: { id },
          data,
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'REGION_UPDATED',
            targetType: 'REGION',
            targetId: id,
            metadata: {
              before: {
                name: existing.name,
                code: existing.code,
                description: existing.description,
              },
              after: {
                name: updated.name,
                code: updated.code,
                description: updated.description,
              },
            },
          },
        });

        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Region code already exists');
      }

      throw error;
    }
  }
  async createRegion(actorId: number, dto: CreateRegionDto) {
    const name = dto.name?.trim();
    const code = dto.code?.trim();
    const description = dto.description?.trim() || null;

    if (!name || name.length > 100) {
      throw new BadRequestException('Invalid region name');
    }

    if (!code || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
      throw new BadRequestException('Invalid region code');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const region = await tx.region.create({
          data: { name, code, description },
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'REGION_CREATED',
            targetType: 'REGION',
            targetId: region.id,
            metadata: {
              name: region.name,
              code: region.code,
            },
          },
        });

        return region;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Region code already exists');
      }

      throw error;
    }
  }
}
