import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getStatus() {
    let dbStatus = { status: 'ok', latency_ms: 0 };
    let cacheStatus = { status: 'disabled', latency_ms: 0 };

    // Check PostgreSQL connectivity and measure query latency.
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus.latency_ms = Date.now() - start;
    } catch {
      dbStatus.status = 'fail';
    }

    // Check Redis only when it is configured.
    // RedisService owns the connection and handles its lifecycle.
    if (this.redis.getClient()) {
      const start = Date.now();
      const isAvailable = await this.redis.ping();

      cacheStatus = {
        status: isAvailable ? 'ok' : 'fail',
        latency_ms: isAvailable ? Date.now() - start : 0,
      };
    }

    // Redis is optional, but a configured and unavailable Redis
    // should cause the overall status to become degraded.
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