import {
    Injectable,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { createQueueConnection } from '../../../infrastructure/queue/queue-connection.factory';
import { JobExecutionService } from './job-execution.service';
import { JobHandlerRegistry } from './job-handler.registry';

interface ServerOperationData {
    jobId: string;
    serverId: number;
}

@Injectable()
export class JobWorkerService implements OnModuleInit, OnModuleDestroy {
    private worker: Worker<ServerOperationData> | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly executionService: JobExecutionService,
        private readonly handlerRegistry: JobHandlerRegistry,
    ) {}

    // Register the worker only when explicitly enabled and ready.
    onModuleInit(): void {
        const enabled =
            this.configService.get<string>('JOB_WORKER_ENABLED') === 'true';

        if (!enabled) {
            return;
        }

        // Never consume jobs until all operation handlers are registered.
        if (!this.handlerRegistry.hasAllHandlers()) {
            throw new Error(
                'Job worker cannot be enabled: server operation handlers are not implemented',
            );
        }

        if (!this.configService.get<string>('REDIS_URL')) {
            throw new Error(
                'REDIS_URL is required when the job worker is enabled',
            );
        }

        this.worker = new Worker<ServerOperationData>(
            'server-operations',
            async (job) => this.processJob(job),
            {
                connection: createQueueConnection(
                    this.configService,
                    'worker',
                ),
                concurrency: 1,
            },
        );

        this.worker.on('error', (error) => {
            console.error('[JobWorker] Worker error:', error);
        });

        this.worker.on('failed', (job, error) => {
            console.error(
                `[JobWorker] BullMQ job ${job?.id ?? 'unknown'} failed`,
                error,
            );
        });
    }

    // Validate and atomically claim a job before executing its handler.
    private async processJob(
        job: Job<ServerOperationData>,
    ): Promise<void> {
        const { jobId, serverId } = job.data;

        if (
            typeof jobId !== 'string' ||
            jobId.length === 0 ||
            !Number.isInteger(serverId) ||
            serverId <= 0 ||
            job.id !== jobId
        ) {
            throw new Error(
                'Invalid or mismatched server operation payload',
            );
        }

        const persistedJob = await this.prisma.job.findUnique({
            where: { id: jobId },
        });

        if (
            !persistedJob ||
            persistedJob.serverId !== serverId ||
            persistedJob.type !== job.name
        ) {
            throw new Error(
                `Job ${jobId} does not match PostgreSQL`,
            );
        }

        // Resolve the handler before claiming the job.
        const handler = this.handlerRegistry.get(persistedJob.type);

        if (!handler) {
            throw new Error(
                `No handler registered for operation ${persistedJob.type}`,
            );
        }

        // Prevent duplicate execution, including BullMQ redelivery.
        const acquired = await this.executionService.startJob(
            jobId,
            serverId,
        );

        if (!acquired) {
            console.warn(
                `[JobWorker] Skipping job ${jobId}: execution claim was rejected`,
            );
            return;
        }

        // Only execution failures should mark the operation as FAILED.
        try {
            await handler.execute({ jobId, serverId });
        } catch (error) {
            try {
                await this.executionService.failJob(jobId, error);
            } catch (persistError) {
                console.error(
                    `[JobWorker] Failed to persist execution failure for ${jobId}`,
                    persistError,
                );
            }

            throw error;
        }

        // Persist success separately from handler execution.
        // A database failure must not falsely mark a successful operation
        // as FAILED or trigger another execution.
        const completed = await this.executionService.completeJob(jobId);

        if (!completed) {
            throw new Error(
                `Operation succeeded, but completion could not be persisted for job ${jobId}`,
            );
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.worker?.close();
    }
}