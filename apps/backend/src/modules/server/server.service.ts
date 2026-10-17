
import { Injectable, NotFoundException } from '@nestjs/common';

// Services
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';

@Injectable()
export class ServerService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async getUserServers(userId: number) {
    return this.prisma.server.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserServer(serverId: number, userId: number) {
    const server = await this.prisma.server.findFirst({
      where: {
        id: serverId,
        userId,
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    return server;
  }

  async createServer(userId: number, name: string) {
    return this.prisma.server.create({
      data: {
        name: name.trim(),
        userId,
      },
    });
  }

  async inviteUser(userId: number) {
    const notification = await this.notificationsService.create(
      userId,
      'Zostałeś zaproszony do serwera',
    );

    await this.notificationsGateway.sendToUser(userId, notification);
  }
}
