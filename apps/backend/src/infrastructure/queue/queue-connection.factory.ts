import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type QueueConnectionRole = 'producer' | 'worker';

export function createQueueConnection(
    configService: ConfigService,
    role: QueueConnectionRole,
): Redis {
    const redisUrl = configService.get<string>('REDIS_URL');

    if (!redisUrl) {
        throw new Error('REDIS_URL is required for BullMQ');
    }

    const client = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: role === 'worker' ? null : 1,
        retryStrategy: (times) => Math.min(times * 200, 3000),
    });

    // Connection errors are handled separately from individual queue operations.
    client.on('error', (error) => {
        console.error(`[BullMQ Redis ${role}]`, error.message);
    });

    return client;
}