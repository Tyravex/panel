import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Core
import { PrismaModule } from '@/prisma/prisma.module';
import { RbacModule } from '@/rbac/rbac.module';

// Authentication and users
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';

// Infrastructure
import { NodesModule } from '@/modules/nodes/nodes.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { StatusModule } from '@/modules/status/status.module';

// Services and installation templates
import { ServicesModule } from '@/modules/services/services.module';
import { EggsModule } from '@/modules/eggs/eggs.module';

// Legacy server support
import { ServerModule } from '@/modules/server/server.module';

// Extensions and localization
import { PluginsModule } from '@/modules/plugins/plugins.module';
import { LanguagesModule } from '@/modules/languages/languages.module';

// Notifications and audit
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AdminAuditModule } from '@/modules/audit/admin-audit.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Core
    PrismaModule,
    RbacModule,

    // Authentication and users
    AuthModule,
    UsersModule,

    // Infrastructure
    NodesModule,
    JobsModule,
    StatusModule,

    // Services and installation templates
    ServicesModule,
    EggsModule,

    // Legacy server support
    ServerModule,

    // Extensions and localization
    PluginsModule,
    LanguagesModule,

    // Notifications and audit
    NotificationsModule,
    AdminAuditModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
