import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController, TestController } from './notifications.controller';

@Module({
  providers: [NotificationsService, NotificationsGateway],
  controllers: [NotificationsController, TestController],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}