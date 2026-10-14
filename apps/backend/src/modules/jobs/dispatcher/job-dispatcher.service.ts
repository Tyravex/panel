import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '../../../infrastructure/queue/queue.service';

@Injectable()
export class JobDispatcherService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: QueueService,
    ) { }
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
    // Find dispatcher claims that may have been abandoned after a crash.
    async findStaleDispatchingJobs(limit = 50) {
        const batchSize = Math.max(1, Math.min(Math.trunc(limit) || 50, 100));
        const cutoff = new Date(Date.now() - 5 * 60 * 1000);

        return this.prisma.job.findMany({
            where: {
                status: 'DISPATCHING',
                dispatchClaimedAt: {
                    lt: cutoff,
                },
            },
            orderBy: [
                { dispatchClaimedAt: 'asc' },
                { id: 'asc' },
            ],
            take: batchSize,
        });
    }
    // Inspect an abandoned claim without changing its state.
    async inspectStaleJob(jobId: string) {
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
        });

        if (!job || job.status !== 'DISPATCHING') {
            return null;
        }

        const queueState = await this.queueService.getJobState(job.id);

        return {
            jobId: job.id,
            databaseStatus: job.status,
            queueState,
            dispatchClaimedAt: job.dispatchClaimedAt,
        };
    }
    // Reconcile an abandoned claim when the job is still waiting in BullMQ.
    async recoverWaitingJob(jobId: string): Promise<boolean> {
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
        });

        if (
            !job ||
            job.status !== 'DISPATCHING' ||
            !job.dispatchClaimedAt
        ) {
            return false;
        }

        // Never recover a claim that may still belong to an active dispatcher.
        const cutoff = new Date(Date.now() - 5 * 60 * 1000);

        if (job.dispatchClaimedAt >= cutoff) {
            return false;
        }

        const queueState = await this.queueService.getJobState(job.id);

        if (queueState !== 'waiting' && queueState !== 'delayed') {
            return false;
        }

        const result = await this.prisma.job.updateMany({
            where: {
                id: job.id,
                status: 'DISPATCHING',
                dispatchClaimedAt: job.dispatchClaimedAt,
            },
            data: {
                status: 'QUEUED',
                queueJobId: job.id,
            },
        });

        return result.count === 1;
    }
    // Atomically claim a pending job before sending it to Redis.
    async claimJob(jobId: string): Promise<boolean> {
        const result = await this.prisma.job.updateMany({
            where: {
                id: jobId,
                status: 'PENDING',
            },
            data: {
                status: 'DISPATCHING',
                dispatchClaimedAt: new Date(),
            },
        });

        return result.count === 1;
    }
    // Dispatch a persisted job and update its state only after Redis accepts it.
    async dispatchJob(jobId: string): Promise<boolean> {
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
        });

        if (!job || job.status !== 'PENDING' || job.serverId === null) {
            return false;
        }

        // Only the dispatcher that successfully claims the job may enqueue it.
        if (!(await this.claimJob(job.id))) {
            return false;
        }

        let queuedJob;

        try {
            queuedJob = await this.queueService.enqueueJob(
                job.id,
                job.type,
                job.serverId,
            );
        } catch (error) {
            console.error(
                `[JobDispatcher] Failed to enqueue job ${job.id}`,
                error,
            );

            // Redis may have accepted the job before the connection failed.
            // Keep the claim until reconciliation determines what happened.
            return false;
        }

        const result = await this.prisma.job.updateMany({
            where: {
                id: job.id,
                status: 'DISPATCHING',
            },
            data: {
                status: 'QUEUED',
                queueJobId: queuedJob.id,
            },
        });

        return result.count === 1;
    }
    // Dispatch pending jobs in bounded batches without stopping on individual failures.
    async dispatchPendingJobs(limit = 50): Promise<number> {
        const jobs = await this.findPendingJobs(limit);
        let dispatched = 0;

        for (const job of jobs) {
            try {
                if (await this.dispatchJob(job.id)) {
                    dispatched++;
                }
            } catch (error) {
                console.error(
                    `[JobDispatcher] Unexpected error for job ${job.id}`,
                    error,
                );
            }
        }

        return dispatched;
    }
    // Reconcile a stale claim with a known BullMQ state.
    async recoverStaleJob(jobId: string): Promise<boolean> {
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
        });

        if (
            !job ||
            job.status !== 'DISPATCHING' ||
            !job.dispatchClaimedAt
        ) {
            return false;
        }

        const cutoff = new Date(Date.now() - 5 * 60 * 1000);

        if (job.dispatchClaimedAt >= cutoff) {
            return false;
        }

        const queueState = await this.queueService.getJobState(job.id);

        // Waiting and delayed jobs can safely return to QUEUED.
        if (queueState === 'waiting' || queueState === 'delayed') {
            return this.recoverWaitingJob(job.id);
        }

        // A worker may already be executing the operation.
        // Do not modify active jobs until worker-side state transitions exist.
        if (queueState === 'active') {
            console.warn(
                `[JobDispatcher] Job ${job.id} is active in BullMQ; awaiting worker reconciliation`,
            );
            return false;
        }

        // BullMQ completion alone does not prove the server operation succeeded.
        // A future worker must persist the authoritative result in PostgreSQL.
        if (queueState === 'completed' || queueState === 'failed') {
            console.warn(
                `[JobDispatcher] Job ${job.id} is ${queueState} in BullMQ but DISPATCHING in PostgreSQL`,
            );
            return false;
        }

        // Missing or unknown Redis state must not trigger blind re-enqueueing.
        console.warn(
            `[JobDispatcher] Job ${job.id} has unresolved BullMQ state: ${queueState}`,
        );

        return false;
    }

    // Inspect and reconcile stale claims in bounded batches.
    async recoverStaleJobs(limit = 50): Promise<number> {
        const jobs = await this.findStaleDispatchingJobs(limit);
        let recovered = 0;

        for (const job of jobs) {
            try {
                if (await this.recoverStaleJob(job.id)) {
                    recovered++;
                }
            } catch (error) {
                console.error(
                    `[JobDispatcher] Recovery failed for job ${job.id}`,
                    error,
                );
            }
        }

        return recovered;
    }
}