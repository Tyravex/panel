import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    // Redis is optional during local development.
    // Features that require Redis can check whether it is configured.
    this.client = redisUrl
      ? new Redis(redisUrl, {
        // Connect only when Redis is first used.
        lazyConnect: true,

        // Limit the time spent establishing a TCP connection.
        connectTimeout: 3000,

        // Fail individual commands quickly when Redis is unavailable.
        maxRetriesPerRequest: 1,

        // Keep reconnecting with a bounded delay.
        // Temporary Redis outages must not require restarting the API.
        // BullMQ workers will use a separate connection strategy.
        retryStrategy: (times) => {
          return Math.min(times * 200, 3000);
        },
      })
      : null;
  }

  // Expose the shared Redis client to infrastructure consumers.
  // A null value means Redis has not been configured.
  getClient(): Redis | null {
    return this.client;
  }

    async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    // A health check must not block the API indefinitely.
    const timeoutMs = 2000;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const pingPromise = this.client.ping();

      const result = await Promise.race([
        pingPromise,
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);

      return result === 'PONG';
    } catch {
      return false;
    } finally {
      // Clear the timer when Redis responds before the deadline.
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  onModuleDestroy(): void {
    // Release the connection when NestJS shuts down the module.
    this.client?.disconnect();
  }
}