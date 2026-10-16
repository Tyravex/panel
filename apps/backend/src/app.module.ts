import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '@/prisma/prisma.module';

import { UsersModule } from '@/modules/users/users.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { StatusModule } from '@/modules/status/status.module';
import { ServerModule } from '@/modules/server/server.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { NodesModule } from '@/modules/nodes/nodes.module';
import { RbacModule } from '@/rbac/rbac.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RbacModule,
    StatusModule,
    UsersModule,
    ServerModule,
    AuthModule,
    NotificationsModule,
    JobsModule,
    NodesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }