import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  language: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      assignedAt: true,
      role: { select: { id: true, name: true } },
    },
  },
  _count: { select: { servers: true, services: true } },
} as const;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(rawPage?: string, rawSearch?: string) {
    const page = rawPage === undefined ? 1 : Number(rawPage);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) {
      throw new BadRequestException('Invalid page');
    }
    const search = (rawSearch ?? '').trim();
    if (search.length > 100) {
      throw new BadRequestException('Search must be 100 characters or fewer');
    }
    const where = search
      ? { OR: [
          { username: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ] }
      : {};
    const limit = 20;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
