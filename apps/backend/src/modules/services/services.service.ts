import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Return only services owned by the authenticated user.
  async getUserServices(userId: number) {
    return this.prisma.service.findMany({
      where: {
        userId,
      },
      include: {
        category: {
          select: {
            key: true,
            name: true,
          },
        },
        server: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
