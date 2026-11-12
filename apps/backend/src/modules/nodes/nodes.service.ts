import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { NodeTokenService } from './node-token.service';
import { NodeHeartbeatMonitorService } from './services/node-heartbeat-monitor.service';

@Injectable()
export class NodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: NodeTokenService,
    private readonly heartbeatMonitor: NodeHeartbeatMonitorService,
  ) { }

  async findAll() {
    await this.heartbeatMonitor.expireStaleNodes();

    return this.prisma.node.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        manualAllocationEnabled: true,
        automaticAllocationEnabled: true,
        regionId: true,
        locationId: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(nodeId: string) {
    await this.heartbeatMonitor.expireStaleNodes();

    return this.prisma.node.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        name: true,
        status: true,
        manualAllocationEnabled: true,
        automaticAllocationEnabled: true,
        regionId: true,
        locationId: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createNode(input: string | CreateNodeDto) {
    const body: CreateNodeDto =
      typeof input === 'string' ? { name: input } : input;

    const normalizedName = body.name?.trim();
    const regionId = body.regionId?.trim() || null;
    const locationId = body.locationId?.trim() || null;
    const manualAllocationEnabled = body.manualAllocationEnabled ?? true;
    const automaticAllocationEnabled = body.automaticAllocationEnabled ?? false;

    if (
      typeof manualAllocationEnabled !== 'boolean' ||
      typeof automaticAllocationEnabled !== 'boolean' ||
      (!manualAllocationEnabled && !automaticAllocationEnabled)
    ) {
      throw new BadRequestException(
        'At least one node allocation method must be enabled',
      );
    }

    if (!normalizedName || normalizedName.length > 100) {
      throw new BadRequestException(
        'Node name must contain between 1 and 100 characters',
      );
    }

    if (body.regionId !== undefined && !regionId) {
      throw new BadRequestException('Region ID cannot be empty');
    }

    if (body.locationId !== undefined && !locationId) {
      throw new BadRequestException('Location ID cannot be empty');
    }

    if (locationId && !regionId) {
      throw new BadRequestException(
        'Region is required when location is specified',
      );
    }

    const token = this.tokenService.generateToken();
    const tokenHash = this.tokenService.hashToken(token);

    try {
      const node = await this.prisma.$transaction(async (tx) => {
        if (regionId) {
          const region = await tx.region.findUnique({
            where: { id: regionId },
            select: { id: true },
          });

          if (!region) {
            throw new NotFoundException('Region not found');
          }
        }

        if (locationId) {
          // Serialize node assignment with Location region changes.
          await tx.$queryRaw`
            SELECT "id"
            FROM "Location"
            WHERE "id" = ${locationId}
            FOR UPDATE
          `;

          const location = await tx.location.findUnique({
            where: { id: locationId },
            select: { regionId: true },
          });

          if (!location) {
            throw new NotFoundException('Location not found');
          }

          if (location.regionId !== regionId) {
            throw new BadRequestException(
              'Location does not belong to selected region',
            );
          }
        }

        return tx.node.create({
          data: {
            name: normalizedName,
            tokenHash,
            regionId,
            locationId,
            manualAllocationEnabled,
            automaticAllocationEnabled,
          },
          select: {
            id: true,
            name: true,
            status: true,
            manualAllocationEnabled: true,
            automaticAllocationEnabled: true,
            regionId: true,
            locationId: true,
            createdAt: true,
          },
        });
      });

      return {
        ...node,
        token,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Concurrent node operation conflict. Please retry.',
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Region or location is no longer available',
        );
      }

      throw error;
    }
  }
  async updateNode(
    nodeId: string,
    body: UpdateNodeDto,
    actorId: number,
  ) {
    if (!nodeId?.trim()) {
      throw new BadRequestException('Node ID is required');
    }

    if (
      body.name === undefined &&
      body.regionId === undefined &&
      body.locationId === undefined &&
      body.manualAllocationEnabled === undefined &&
      body.automaticAllocationEnabled === undefined
    ) {
      throw new BadRequestException('No fields to update');
    }

    const name =
      body.name === undefined ? undefined : body.name?.trim();

    const regionId =
      body.regionId === undefined
        ? undefined
        : body.regionId === null
          ? null
          : body.regionId.trim();

    const locationId =
      body.locationId === undefined
        ? undefined
        : body.locationId === null
          ? null
          : body.locationId.trim();

    if (
      (body.manualAllocationEnabled !== undefined &&
        typeof body.manualAllocationEnabled !== 'boolean') ||
      (body.automaticAllocationEnabled !== undefined &&
        typeof body.automaticAllocationEnabled !== 'boolean')
    ) {
      throw new BadRequestException('Invalid node allocation settings');
    }

    if (name !== undefined && (!name || name.length > 100)) {
      throw new BadRequestException('Invalid node name');
    }

    if (regionId === '' || locationId === '') {
      throw new BadRequestException(
        'Region and location IDs cannot be empty',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Node"
          WHERE "id" = ${nodeId}
          FOR UPDATE
        `;

        const existing = await tx.node.findUnique({
          where: { id: nodeId },
          select: {
            id: true,
            name: true,
            regionId: true,
            locationId: true,
            manualAllocationEnabled: true,
            automaticAllocationEnabled: true,
          },
        });

        if (!existing) {
          throw new NotFoundException('Node not found');
        }

        const nextRegionId =
          regionId === undefined ? existing.regionId : regionId;

        const nextLocationId =
          locationId === undefined ? existing.locationId : locationId;

        const nextManualAllocationEnabled =
          body.manualAllocationEnabled ??
          existing.manualAllocationEnabled;

        const nextAutomaticAllocationEnabled =
          body.automaticAllocationEnabled ??
          existing.automaticAllocationEnabled;

        if (
          !nextManualAllocationEnabled &&
          !nextAutomaticAllocationEnabled
        ) {
          throw new BadRequestException(
            'At least one node allocation method must be enabled',
          );
        }

        if (nextLocationId && !nextRegionId) {
          throw new BadRequestException(
            'Region is required when location is specified',
          );
        }

        if (nextRegionId) {
          const region = await tx.region.findUnique({
            where: { id: nextRegionId },
            select: { id: true },
          });

          if (!region) {
            throw new NotFoundException('Region not found');
          }
        }

        if (nextLocationId) {
          // Serialize node assignment with Location region changes.
          await tx.$queryRaw`
            SELECT "id"
            FROM "Location"
            WHERE "id" = ${nextLocationId}
            FOR UPDATE
          `;

          const location = await tx.location.findUnique({
            where: { id: nextLocationId },
            select: { regionId: true },
          });

          if (!location) {
            throw new NotFoundException('Location not found');
          }

          if (location.regionId !== nextRegionId) {
            throw new BadRequestException(
              'Location does not belong to selected region',
            );
          }
        }

        const data: {
          name?: string;
          regionId?: string | null;
          locationId?: string | null;
          manualAllocationEnabled?: boolean;
          automaticAllocationEnabled?: boolean;
        } = {};

        if (name !== undefined && name !== existing.name) {
          data.name = name;
        }

        if (
          regionId !== undefined &&
          regionId !== existing.regionId
        ) {
          data.regionId = regionId;
        }

        if (
          locationId !== undefined &&
          locationId !== existing.locationId
        ) {
          data.locationId = locationId;
        }

        if (
          body.manualAllocationEnabled !== undefined &&
          body.manualAllocationEnabled !== existing.manualAllocationEnabled
        ) {
          data.manualAllocationEnabled = body.manualAllocationEnabled;
        }

        if (
          body.automaticAllocationEnabled !== undefined &&
          body.automaticAllocationEnabled !== existing.automaticAllocationEnabled
        ) {
          data.automaticAllocationEnabled = body.automaticAllocationEnabled;
        }

        if (Object.keys(data).length === 0) {
          return tx.node.findUnique({
            where: { id: nodeId },
            select: {
              id: true,
              name: true,
              status: true,
              manualAllocationEnabled: true,
              automaticAllocationEnabled: true,
              regionId: true,
              locationId: true,
              lastSeenAt: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        }

        const updated = await tx.node.update({
          where: { id: nodeId },
          data,
          select: {
            id: true,
            name: true,
            status: true,
            manualAllocationEnabled: true,
            automaticAllocationEnabled: true,
            regionId: true,
            locationId: true,
            lastSeenAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'NODE_UPDATED',
            targetType: 'NODE',
            targetId: nodeId,
            metadata: {
              before: {
                name: existing.name,
                regionId: existing.regionId,
                locationId: existing.locationId,
                manualAllocationEnabled: existing.manualAllocationEnabled,
                automaticAllocationEnabled: existing.automaticAllocationEnabled,
              },
              after: {
                name: updated.name,
                regionId: updated.regionId,
                locationId: updated.locationId,
                manualAllocationEnabled: updated.manualAllocationEnabled,
                automaticAllocationEnabled: updated.automaticAllocationEnabled,
              },
            },
          },
        });

        return updated;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Concurrent node operation conflict. Please retry.',
        );
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Region or location is no longer available',
        );
      }

      throw error;
    }
  }
  async deleteNode(nodeId: string, actorId: number) {
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
      throw new BadRequestException('Node ID is required');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize updates/deletes for this Node.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Node"
          WHERE "id" = ${nodeId}
          FOR UPDATE
        `;

        const existing = await tx.node.findUnique({
          where: { id: nodeId },
          select: {
            id: true,
            name: true,
            status: true,
            regionId: true,
            locationId: true,
          },
        });

        if (!existing) {
          throw new NotFoundException('Node not found');
        }

        const assignedServices = await tx.service.count({
          where: { nodeId },
        });

        if (assignedServices > 0) {
          throw new ConflictException(
            'Cannot delete node with assigned services',
          );
        }

        // AgentCommand.nodeId is not a Prisma relation.
        // Preserve command history instead of orphaning it.
        const commandHistory = await tx.agentCommand.count({
          where: { nodeId },
        });

        if (commandHistory > 0) {
          throw new ConflictException(
            'Cannot delete node with Agent command history',
          );
        }

        await tx.node.delete({
          where: { id: nodeId },
        });

        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'NODE_DELETED',
            targetType: 'NODE',
            targetId: nodeId,
            metadata: {
              name: existing.name,
              status: existing.status,
              regionId: existing.regionId,
              locationId: existing.locationId,
            },
          },
        });

        return { success: true };
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error
      ) {
        if (error.code === 'P2003') {
          throw new ConflictException(
            'Cannot delete node with assigned dependencies',
          );
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('Node not found');
        }

        if (error.code === 'P2034') {
          throw new ConflictException(
            'Concurrent node operation conflict. Please retry.',
          );
        }
      }

      throw error;
    }
  }
  async rotateToken(nodeId: string) {
    if (!nodeId?.trim()) {
      throw new BadRequestException('Node ID is required');
    }

    const token = this.tokenService.generateToken();
    const tokenHash = this.tokenService.hashToken(token);

    try {
      const node = await this.prisma.node.update({
        where: { id: nodeId },
        data: {
          tokenHash,
          status: 'OFFLINE',
          lastSeenAt: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      return {
        ...node,
        token,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Node ${nodeId} not found`);
      }

      throw error;
    }
  }

  async authenticateNode(nodeId: string, token: string) {
    if (
      typeof nodeId !== 'string' ||
      !nodeId ||
      typeof token !== 'string' ||
      !token
    ) {
      return null;
    }

    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        name: true,
        status: true,
        tokenHash: true,
      },
    });

    if (!node || !this.tokenService.verifyToken(token, node.tokenHash)) {
      return null;
    }

    return {
      id: node.id,
      name: node.name,
      status: node.status,
    };
  }

  async findAssignedServiceIds(nodeId: string): Promise<string[]> {
    if (typeof nodeId !== 'string' || !nodeId.trim()) {
      throw new BadRequestException('Node ID is required');
    }

    const services = await this.prisma.service.findMany({
      where: {
        nodeId,
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 4097,
    });

    return services.map((service) => service.id);
  }

  async heartbeat(nodeId: string, token: string) {
    if (
      !nodeId ||
      !token ||
      typeof nodeId !== 'string' ||
      typeof token !== 'string'
    ) {
      throw new UnauthorizedException('Invalid node credentials');
    }

    const node = await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        tokenHash: true,
        status: true,
      },
    });

    if (!node || !this.tokenService.verifyToken(token, node.tokenHash)) {
      throw new UnauthorizedException('Invalid node credentials');
    }

    const now = new Date();

    const updated = await this.prisma.node.updateMany({
      where: {
        id: nodeId,
        tokenHash: node.tokenHash,
        status: { not: 'MAINTENANCE' },
      },
      data: {
        status: 'ONLINE',
        lastSeenAt: now,
      },
    });

    if (updated.count === 0) {
      const maintenanceUpdate = await this.prisma.node.updateMany({
        where: {
          id: nodeId,
          tokenHash: node.tokenHash,
          status: 'MAINTENANCE',
        },
        data: {
          lastSeenAt: now,
        },
      });

      if (maintenanceUpdate.count === 0) {
        throw new UnauthorizedException('Invalid node credentials');
      }
    }

    return {
      ok: true,
      lastSeenAt: now.toISOString(),
    };
  }
}
