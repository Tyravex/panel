import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '@/prisma/prisma.module';

import { UsersModule } from '@/modules/users/users.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { StatusModule } from '@/modules/status/status.module';
import { ServerModule } from '@/modules/server/server.module';
import { ServicesModule } from '@/modules/services/services.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { LanguagesModule } from '@/modules/languages/languages.module';
import { PluginsModule } from '@/modules/plugins/plugins.module';
import { AdminAuditModule } from './modules/audit/admin-audit.module';
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
    LanguagesModule,
    PluginsModule,
    UsersModule,
    ServerModule,
    ServicesModule,
    AuthModule,
    NotificationsModule,
    JobsModule,
    NodesModule,
    AdminAuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
