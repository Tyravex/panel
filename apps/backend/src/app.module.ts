import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from '@/rbac/guards/roles.guard';
// Modules
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersModule } from "@/modules/users/users.module";
import { AuthModule } from '@/modules/auth/auth.module';
import { StatusModule } from '@/modules/status/status.module';
import { ServerModule } from "@/modules/server/server.module";
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    StatusModule,
    UsersModule,
    ServerModule,
    AuthModule,
    NotificationsModule,
    JobsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    }
  ],
})

export class AppModule { }