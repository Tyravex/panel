import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JobDispatcherService {
  constructor(private readonly prisma: PrismaService) {}

  // Fetch pending jobs in bounded batches to protect database resources.
  async findPendingJobs(limit = 50) {
    const batchSize = Math.max(1, Math.min(Math.trunc(limit) || 50, 100));

    return this.prisma.job.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: batchSize,
    });
  }
}