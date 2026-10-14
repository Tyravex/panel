import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class JobExecutionService {
    constructor(private readonly prisma: PrismaService) {}

    // Atomically acquire a job before performing server operations.
    async startJob(jobId: string, serverId: number): Promise<boolean> {
        const result = await this.prisma.job.updateMany({
            where: {
                id: jobId,
                serverId,
                status: {
                    in: ['QUEUED', 'DISPATCHING'],
                },
            },
            data: {
                status: 'RUNNING',
                startedAt: new Date(),
                progress: 0,
            },
        });

        return result.count === 1;
    }

    // Update progress only while the job is running.
    async updateProgress(jobId: string, progress: number): Promise<boolean> {
        if (!Number.isFinite(progress)) {
            return false;
        }

        const normalizedProgress = Math.max(
            0,
            Math.min(100, Math.trunc(progress)),
        );

        const result = await this.prisma.job.updateMany({
            where: {
                id: jobId,
                status: 'RUNNING',
            },
            data: {
                progress: normalizedProgress,
            },
        });

        return result.count === 1;
    }

    // Mark a running job as completed after its operation succeeds.
    async completeJob(jobId: string): Promise<boolean> {
        const result = await this.prisma.job.updateMany({
            where: {
                id: jobId,
                status: 'RUNNING',
            },
            data: {
                status: 'COMPLETED',
                progress: 100,
                finishedAt: new Date(),
                errorMessage: null,
            },
        });

        return result.count === 1;
    }

    // Record a terminal failure without overwriting completed jobs.
    async failJob(jobId: string, error: unknown): Promise<boolean> {
        const message =
            error instanceof Error ? error.message : String(error);

        const result = await this.prisma.job.updateMany({
            where: {
                id: jobId,
                status: 'RUNNING',
            },
            data: {
                status: 'FAILED',
                finishedAt: new Date(),
                errorMessage: message.slice(0, 10000),
            },
        });

        return result.count === 1;
    }
}