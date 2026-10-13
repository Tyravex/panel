import { Injectable } from '@nestjs/common';
// Services
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service'
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway'

@Injectable()
export class ServerService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,) { }

  async getUserServers(userId: number) {
    return this.prisma.server.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createServer(userId: number, data: any) {
    return this.prisma.server.create({
      data: {
        name: data.name,
        userId,
      },
    });
  }

  async inviteUser(userId: number) {
    const notification = await this.notificationsService.create(
      userId,
      'Zostałeś zaproszony do serwera',
    );

    this.notificationsGateway.sendToUser(userId, notification);
  }
}