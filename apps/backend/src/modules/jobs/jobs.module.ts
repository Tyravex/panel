
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ServiceJobsController } from './service-jobs.controller';
import { ServiceJobsService } from './service-jobs.service';
import { JobDispatcherService } from './dispatcher/job-dispatcher.service';
import { JobExecutionService } from './worker/job-execution.service';
import { JobWorkerService } from './worker/job-worker.service';
import { JobHandlerRegistry } from './worker/job-handler.registry';

@Module({
  imports: [AuthModule, QueueModule, NotificationsModule],
  controllers: [
    JobsController,
    ServiceJobsController,
  ],
  providers: [
    JobsService,
    ServiceJobsService,
    JobDispatcherService,
    JobExecutionService,
    JobHandlerRegistry,
    JobWorkerService,
  ],
})
export class JobsModule { }
