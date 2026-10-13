import { Module } from '@nestjs/common';

// Controllers
import { ServerController } from './server.controller';

// Services
import { ServerService } from './server.service';

// Modules
import { AuthModule } from '@/modules/auth/auth.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

// PrismaService is provided globally by PrismaModule.
// Do not register it again in feature modules.
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}