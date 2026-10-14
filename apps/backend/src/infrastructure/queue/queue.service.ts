import {
    Injectable,
    OnModuleDestroy,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { createQueueConnection } from './queue-connection.factory';

@Injectable()
export class QueueService implements OnModuleDestroy {
    private readonly queue: Queue | null;

    constructor(private readonly configService: ConfigService) {
        const redisUrl = this.configService.get<string>('REDIS_URL');
        // Keep the API available when Redis is not configured.
        this.queue = redisUrl
            ? new Queue('server-operations', {
                connection: createQueueConnection(configService, 'producer'),

                // Avoid retaining completed jobs in Redis indefinitely.
                defaultJobOptions: {
                    removeOnComplete: 1000,
                    removeOnFail: 5000,
                },
            })
            : null;

        // Log queue-level errors to avoid unhandled error events.
        this.queue?.on('error', (error) => {
            console.error('[BullMQ Queue]', error.message);
        });
    }
    // Enqueue a persisted job using a stable identifier.
    async enqueueJob(jobId: string, type: string, serverId: number) {
        if (!this.queue) {
            throw new ServiceUnavailableException('Job queue is not configured');
        }

        return this.queue.add(
            type,
            { jobId, serverId },
            {
                jobId,
                // Server operations must not be retried automatically.
                // Recovery requires checking the persisted execution state first.
                attempts: 1,
            },
        );
    }
    // Other modules can access the queue without managing Redis connections.
    getQueue(): Queue | null {
        return this.queue;
    }
    // Find an existing BullMQ job by its PostgreSQL identifier.
    async findJob(jobId: string) {
        if (!this.queue) {
            throw new ServiceUnavailableException('Job queue is not configured');
        }

        return this.queue.getJob(jobId);
    }
    // Read the current state of an existing BullMQ job.
    async getJobState(jobId: string) {
        const job = await this.findJob(jobId);

        if (!job) {
            return null;
        }

        return job.getState();
    }
    //
    async onModuleDestroy(): Promise<void> {
        // Close the queue and its Redis connection during shutdown.
        await this.queue?.close();
    }
}