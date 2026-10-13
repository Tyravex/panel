import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  // Reuse the existing authentication module.
  imports: [AuthModule],

  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}