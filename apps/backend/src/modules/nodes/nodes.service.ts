import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
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
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createNode(name: string) {
    const normalizedName = name?.trim();

    if (!normalizedName || normalizedName.length > 100) {
      throw new BadRequestException(
        'Node name must contain between 1 and 100 characters',
      );
    }

    const token = this.tokenService.generateToken();
    const tokenHash = this.tokenService.hashToken(token);

    const node = await this.prisma.node.create({
      data: {
        name: normalizedName,
        tokenHash,
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      ...node,
      token,
    };
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
