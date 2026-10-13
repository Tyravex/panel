import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Module({
  // Keep Redis connection management in one infrastructure module.
  // Feature modules should inject RedisService instead of creating
  // their own Redis connections.
  providers: [RedisService],

  // Allow other modules to inject the shared RedisService.
  exports: [RedisService],
})
export class RedisModule {}