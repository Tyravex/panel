import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@/prisma/prisma.service';
import { SetServiceMemberDto, UpdateServiceMemberDto } from './dto/service-member.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserServices(userId: number) {
    return this.prisma.service.findMany({
      where: { userId },
      include: {
        category: { select: { key: true, name: true } },
        server: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertOwner(serviceId: string, ownerId: number): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, userId: ownerId },
      select: { id: true },
    });
    // Hide the existence of services that the requester does not own.
    if (!service) throw new NotFoundException('Service not found');
  }

  async getMembers(serviceId: string, ownerId: number) {
    await this.assertOwner(serviceId, ownerId);
    return this.prisma.serviceMember.findMany({
      where: { serviceId },
      select: {
        userId: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(serviceId: string, ownerId: number, dto: SetServiceMemberDto) {
    await this.assertOwner(serviceId, ownerId);
    if (dto.userId === ownerId) {
      throw new BadRequestException('The service owner cannot be added as a member');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.serviceMember.findUnique({
      where: { serviceId_userId: { serviceId, userId: dto.userId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('User is already a service member');

    try {
      return await this.prisma.serviceMember.create({
        data: { serviceId, userId: dto.userId, permissions: dto.permissions },
        select: { userId: true, permissions: true, createdAt: true, updatedAt: true },
      });
    } catch (error: unknown) {
      // Handle concurrent attempts to add the same member.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('User is already a service member');
      }
      throw error;
    }
  }

  async updateMember(
    serviceId: string,
    ownerId: number,
    memberUserId: number,
    dto: UpdateServiceMemberDto,
  ) {
    await this.assertOwner(serviceId, ownerId);
    const member = await this.prisma.serviceMember.findUnique({
      where: { serviceId_userId: { serviceId, userId: memberUserId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Service member not found');
    return this.prisma.serviceMember.update({
      where: { id: member.id },
      data: { permissions: dto.permissions },
      select: { userId: true, permissions: true, createdAt: true, updatedAt: true },
    });
  }

  async removeMember(serviceId: string, ownerId: number, memberUserId: number) {
    await this.assertOwner(serviceId, ownerId);
    const result = await this.prisma.serviceMember.deleteMany({
      where: { serviceId, userId: memberUserId },
    });
    if (result.count === 0) throw new NotFoundException('Service member not found');
    return { removed: true };
  }
}
