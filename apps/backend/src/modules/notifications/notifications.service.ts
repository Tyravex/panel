import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) { }

  async create(userId: number, content: string) {
    return this.prisma.notification.create({
      data: {
        content,
        userId,
      },
    });
  }

  async findForUser(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: number, userId: number) {
    if (!Number.isSafeInteger(id) || id <= 0 ||
      !Number.isSafeInteger(userId) || userId <= 0) {
      return null;
    }

    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        read: true,
      },
    });

    return result.count === 1;
  }
}