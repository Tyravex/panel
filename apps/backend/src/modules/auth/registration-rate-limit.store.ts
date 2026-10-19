import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 20;
// INCR and EXPIRE run atomically, including the first request.
const SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}
`;

@Injectable()
export class RegistrationRateLimitStore implements OnModuleDestroy {
    private readonly redis: Redis | null;
    private connectionPromise: Promise<void> | null = null;

    constructor(config: ConfigService) {
        const url = config.get<string>('REDIS_URL');
        this.redis = url ? new Redis(url, {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 0,
            connectTimeout: 1500,
            retryStrategy: () => null,
        }) : null;
        this.redis?.on('error', () => { /* Requests fail closed on Redis errors. */ });
    }

    private async ensureConnected(): Promise<void> {
        const redis = this.redis;
        if (!redis) throw new ServiceUnavailableException('Registration temporarily unavailable');
        if (redis.status === 'ready') return;

        // Share the initial connection attempt across concurrent requests.
        if (!this.connectionPromise) {
            if (redis.status !== 'wait') throw new Error('Redis connection is unavailable');
            this.connectionPromise = redis.connect();
        }
        await this.connectionPromise;
        // Read the current status after the asynchronous connection completes.
        if (String(redis.status) !== 'ready') throw new Error('Redis is not ready');
    }

    async consume(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
        if (!this.redis) throw new ServiceUnavailableException('Registration temporarily unavailable');
        try {
            await this.ensureConnected();
            // Avoid storing raw client addresses as Redis keys.
            const digest = createHash('sha256').update(ip).digest('hex');
            const result = await this.redis.eval(SCRIPT, 1, `registration:rate:${digest}`, WINDOW_SECONDS);
            if (!Array.isArray(result) || result.length !== 2) throw new Error('Unexpected Redis response');
            const count = Number(result[0]);
            const ttl = Number(result[1]);
            if (!Number.isFinite(count) || !Number.isFinite(ttl)) throw new Error('Invalid Redis response');
            return { allowed: count <= MAX_ATTEMPTS, retryAfter: Math.max(1, Math.ceil(ttl)) };
        } catch {
            throw new ServiceUnavailableException('Registration temporarily unavailable');
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.redis?.disconnect();
    }
}
