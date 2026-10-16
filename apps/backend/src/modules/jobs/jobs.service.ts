import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserDTO } from '@shared/types';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(user: UserDTO, data: CreateJobDto) {
    // Global permission to manage servers owned by other users.
    const canManageAnyServer =
      user.permissions.includes('server:manage:any');

    // Server owners can perform all supported job operations.
    // Server member permissions will be handled separately.
    const server = await this.prisma.server.findFirst({
      where: {
        id: data.serverId,
        ...(canManageAnyServer ? {} : { userId: user.id }),
      },
      select: {
        id: true,
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // Job ownership always comes from the authenticated user.
    return this.prisma.job.create({
      data: {
        type: data.type,
        userId: user.id,
        serverId: server.id,
        status: 'PENDING',
        progress: 0,
      },
    });
  }

  async findAllForUser(userId: number) {
    return this.prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(userId: number, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        userId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }
}