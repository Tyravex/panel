import * as bcrypt from 'bcryptjs';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const safeUserSelect = {
  id: true, username: true, email: true, avatar: true, language: true,
  isActive: true, createdAt: true, updatedAt: true,
  roles: { select: { assignedAt: true, role: { select: { id: true, name: true } } } },
  _count: { select: { servers: true, services: true } },
} as const;

const usernamePattern = /^[A-Za-z0-9_-]{3,32}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(rawPage?: string, rawSearch?: string, rawStatus?: string) {
    const page = rawPage === undefined ? 1 : Number(rawPage);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Invalid page');
    const search = (rawSearch ?? '').trim();
    if (search.length > 100) throw new BadRequestException('Search must be 100 characters or fewer');
    if (rawStatus && !['active', 'disabled', 'all'].includes(rawStatus)) throw new BadRequestException('Invalid status');
    const where: Prisma.UserWhereInput = {
      ...(rawStatus === 'active' ? { isActive: true } : rawStatus === 'disabled' ? { isActive: false } : {}),
      ...(search ? { OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const limit = 20;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: safeUserSelect, orderBy: { id: 'asc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: safeUserSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private validateIdentity(username: unknown, email: unknown) {
    if (typeof username !== 'string' || !usernamePattern.test(username.trim())) throw new BadRequestException('Username must contain 3-32 letters, digits, _ or -');
    if (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email.trim())) throw new BadRequestException('Invalid email');
    return { username: username.trim(), email: email.trim().toLowerCase() };
  }

  private async unique<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Username or email already exists');
      throw error;
    }
  }

  async create(input: { username?: string; email?: string; password?: string }) {
    const identity = this.validateIdentity(input?.username, input?.email);
    if (typeof input?.password !== 'string' || input.password.length < 12 || input.password.length > 128) throw new BadRequestException('Password must be 12-128 characters');
    const password = await bcrypt.hash(input.password, 12);
    return this.unique(() => this.prisma.user.create({ data: { ...identity, password }, select: safeUserSelect }));
  }

  async update(id: number, input: { username?: string; email?: string }) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Invalid user ID');
    const identity = this.validateIdentity(input?.username, input?.email);
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');
    return this.unique(() => this.prisma.user.update({ where: { id }, data: identity, select: safeUserSelect }));
  }

  async setActive(id: number, isActive: unknown, actorId: number) {
    if (!Number.isSafeInteger(id) || id <= 0 || typeof isActive !== 'boolean') throw new BadRequestException('Invalid user status');
    if (!isActive && id === actorId) throw new BadRequestException('Cannot disable your own account');
    return this.prisma.$transaction(async (tx) => {
      // Same advisory lock as RBAC Owner membership changes prevents concurrent last-Owner removal.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(847201, 1)::text`;
      const target = await tx.user.findUnique({ where: { id }, select: { id: true, isActive: true, roles: { select: { role: { select: { name: true } } } } } });
      if (!target) throw new NotFoundException('User not found');
      if (!isActive && target.isActive && target.roles.some(({ role }) => role.name === 'Owner')) {
        const activeOwners = await tx.user.count({ where: { isActive: true, roles: { some: { role: { name: 'Owner' } } } } });
        if (activeOwners <= 1) throw new ConflictException('Cannot disable the last active Owner');
      }
      const user = await tx.user.update({ where: { id }, data: { isActive }, select: safeUserSelect });
      if (!isActive) {
        // Revocation is committed atomically with account deactivation.
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return user;
    });
  }
}
