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
          // Prevent Redis connection failures from producing
          // unhandled error events.
          lazyConnect: true,
          maxRetriesPerRequest: 1,
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

    try {
      // ioredis connects automatically when the first command is sent.
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    // Release the connection when NestJS shuts down the module.
    this.client?.disconnect();
  }
}