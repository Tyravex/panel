import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class StatusService {
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }
  }

  async getStatus() {
    let dbStatus = { status: 'ok', latency_ms: 0 };
    let cacheStatus = { status: 'disabled', latency_ms: 0 };

    // 🗄 Database check
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus.latency_ms = Date.now() - start;
    } catch {
      dbStatus.status = 'fail';
    }

    // Redis check
    if (this.redis) {
      try {
        const start = Date.now();
        await this.redis.ping();
        cacheStatus = {
          status: 'ok',
          latency_ms: Date.now() - start,
        };
      } catch {
        cacheStatus = { status: 'fail', latency_ms: 0 };
      }
    }

    const overallStatus =
      dbStatus.status === 'ok' &&
      (cacheStatus.status === 'ok' || cacheStatus.status === 'disabled')
        ? 'ok'
        : 'degraded';

    return {
      status: overallStatus,
      uptime: process.uptime(),
      database: dbStatus,
      cache: cacheStatus,
    };
  }
}