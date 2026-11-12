import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) { }

  findAll() {
    return this.prisma.location.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        continent: true,
        country: true,
        state: true,
        city: true,
        regionId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { name: 'asc' },
        { id: 'asc' },
      ],
    });
  }

  async createLocation(actorId: number, dto: CreateLocationDto) {
    const name = dto.name?.trim();
    const code = dto.code?.trim();
    const continent = dto.continent?.trim();
    const country = dto.country?.trim();
    const state = dto.state?.trim() || null;
    const city = dto.city?.trim() || null;
    const regionId = dto.regionId?.trim();

    if (!name || name.length > 100) {
      throw new BadRequestException('Invalid location name');
    }

    if (
      !code ||
      code.length > 50 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)
    ) {
      throw new BadRequestException('Invalid location code');
    }

    if (!continent || !country || !regionId) {
      throw new BadRequestException('Missing location fields');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const region = await tx.region.findUnique({
          where: { id: regionId },
          select: { id: true },
        });

        if (!region) {
          throw new NotFoundException('Region not found');
        }

        const location = await tx.location.create({
          data: {
            name,
            code,
            continent,
            country,
            state,
            city,
            regionId,
          },
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'LOCATION_CREATED',
            targetType: 'LOCATION',
            targetId: location.id,
            metadata: {
              name: location.name,
              code: location.code,
              regionId: location.regionId,
            },
          },
        });

        return location;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          throw new ConflictException(
            'Concurrent location operation conflict. Please retry.',
          );
        }

        if (error.code === 'P2002') {
          throw new ConflictException(
            'Location code already exists in this region',
          );
        }

        if (error.code === 'P2003') {
          throw new NotFoundException('Region not found');
        }
      }

      throw error;
    }
  }
  async deleteLocation(actorId: number, id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent updates and deletions.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Location"
          WHERE "id" = ${id}
          FOR UPDATE
        `;

        const existing = await tx.location.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                nodes: true,
              },
            },
          },
        });

        if (!existing) {
          throw new NotFoundException('Location not found');
        }

        if (existing._count.nodes > 0) {
          throw new ConflictException(
            'Cannot delete location with assigned nodes',
          );
        }

        await tx.location.delete({
          where: { id },
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'LOCATION_DELETED',
            targetType: 'LOCATION',
            targetId: id,
            metadata: {
              name: existing.name,
              code: existing.code,
              continent: existing.continent,
              country: existing.country,
              state: existing.state,
              city: existing.city,
              regionId: existing.regionId,
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
          'Cannot delete location with assigned nodes',
        );
      }

      throw error;
    }
  }
  async updateLocation(actorId: number, id: string, dto: UpdateLocationDto) {
    const data: {
      name?: string;
      code?: string;
      continent?: string;
      country?: string;
      state?: string | null;
      city?: string | null;
      regionId?: string;
    } = {};

    const requiredFields = [
      'name',
      'code',
      'continent',
      'country',
      'regionId',
    ] as const;

    for (const field of requiredFields) {
      if (dto[field] !== undefined) {
        const value = dto[field];

        if (typeof value !== 'string' || !value.trim()) {
          throw new BadRequestException(`Invalid ${field}`);
        }

        data[field] = value.trim();
      }
    }

    if (dto.state !== undefined) {
      data.state = dto.state === null ? null : dto.state.trim() || null;
    }

    if (dto.city !== undefined) {
      data.city = dto.city === null ? null : dto.city.trim() || null;
    }

    if (
      data.code !== undefined &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.code)
    ) {
      throw new BadRequestException('Invalid location code');
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Location"
          WHERE "id" = ${id}
          FOR UPDATE
        `;

        const existing = await tx.location.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new NotFoundException('Location not found');
        }

        if (data.regionId && data.regionId !== existing.regionId) {
          const assignedNodes = await tx.node.count({
            where: { locationId: id },
          });

          if (assignedNodes > 0) {
            throw new ConflictException(
              'Cannot change region of location with assigned nodes',
            );
          }

          const region = await tx.region.findUnique({
            where: { id: data.regionId },
            select: { id: true },
          });

          if (!region) {
            throw new NotFoundException('Region not found');
          }
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

        const updated = await tx.location.update({
          where: { id },
          data,
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'LOCATION_UPDATED',
            targetType: 'LOCATION',
            targetId: id,
            metadata: {
              before: {
                name: existing.name,
                code: existing.code,
                continent: existing.continent,
                country: existing.country,
                state: existing.state,
                city: existing.city,
                regionId: existing.regionId,
              },
              after: {
                name: updated.name,
                code: updated.code,
                continent: updated.continent,
                country: updated.country,
                state: updated.state,
                city: updated.city,
                regionId: updated.regionId,
              },
            },
          },
        });

        return updated;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          throw new ConflictException(
            'Concurrent location operation conflict. Please retry.',
          );
        }

        if (error.code === 'P2002') {
          throw new ConflictException(
            'Location code already exists in this region',
          );
        }

        if (error.code === 'P2003') {
          throw new NotFoundException('Region not found');
        }
      }

      throw error;
    }
  }
  async findById(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        continent: true,
        country: true,
        state: true,
        city: true,
        regionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }
}
