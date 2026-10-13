import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, data: CreateJobDto) {
    // Verify server ownership before creating a server-related job.
    if (data.serverId !== undefined) {
      const server = await this.prisma.server.findFirst({
        where: {
          id: data.serverId,
          userId,
        },
        select: { id: true },
      });

      if (!server) {
        throw new NotFoundException('Server not found');
      }
    }

    // The backend controls the owner and initial lifecycle state.
    return this.prisma.job.create({
      data: {
        type: data.type,
        userId,
        serverId: data.serverId,
        status: 'PENDING',
        progress: 0,
      },
    });
  }

  async findAllForUser(userId: number) {
    // Never return another user's job history.
    return this.prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(userId: number, jobId: string) {
    // Scope lookup to the authenticated user to prevent IDOR access.
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