import {
  Injectable,
  OnModuleDestroy,
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

  // Other modules can access the queue without managing Redis connections.
  getQueue(): Queue | null {
    return this.queue;
  }

  async onModuleDestroy(): Promise<void> {
    // Close the queue and its Redis connection during shutdown.
    await this.queue?.close();
  }
}