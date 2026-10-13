import { Module } from '@nestjs/common';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';

@Module({
  // Import infrastructure dependencies explicitly.
  // PrismaService is already available through the global PrismaModule.
  imports: [RedisModule],

  providers: [StatusService],
  controllers: [StatusController],
})
export class StatusModule {}