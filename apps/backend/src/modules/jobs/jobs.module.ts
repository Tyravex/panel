import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { JobDispatcherService } from './dispatcher/job-dispatcher.service';
import { JobExecutionService } from './worker/job-execution.service';
import { JobWorkerService } from './worker/job-worker.service';
import { JobHandlerRegistry } from './worker/job-handler.registry';

@Module({
  // Reuse the existing authentication module.
  imports: [AuthModule, QueueModule],

  controllers: [JobsController],
  providers: [
    JobsService,
    JobDispatcherService,
    JobExecutionService,
    JobHandlerRegistry,
    JobWorkerService,
  ],
})
export class JobsModule { }