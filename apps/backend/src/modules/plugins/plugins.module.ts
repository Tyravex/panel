import {
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { raw } from 'express';

import { PrismaModule } from '@/prisma/prisma.module';

import { MarketplaceController } from './marketplace/marketplace.controller';
import { MarketplaceRegistryService } from './marketplace/marketplace-registry.service';
import { MarketplaceRepositoriesController } from './marketplace/marketplace-repositories.controller';
import { MarketplaceRepositoriesService } from './marketplace/marketplace-repositories.service';
import { MarketplaceCommunityRegistryService } from './marketplace/marketplace-community-registry.service';

import { PluginInstallerService } from './plugin-installer.service';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';

import { PluginLifecycleController } from './plugin-lifecycle.controller';
import { PluginLifecycleService } from './plugin-lifecycle.service';

import { PluginCleanupClaimService } from './plugin-cleanup-claim.service';
import { PluginRecoveryCoordinatorService } from './plugin-recovery-coordinator.service';
import { PluginRecoveryFilesystemLockService } from './plugin-recovery-filesystem-lock.service';
import { PluginRecoveryLockService } from './plugin-recovery-lock.service';
import { PluginUninstallationCleanupService } from './plugin-uninstallation-cleanup.service';
import { PluginUninstallationRecovery } from './plugin-uninstallation-recovery';
import { PluginUninstallerController } from './plugin-uninstaller.controller';
import { PluginUninstallerService } from './plugin-uninstaller.service';

export const MAX_PLUGIN_UPLOAD_BYTES = 20 * 1024 * 1024;

@Module({
  imports: [PrismaModule],

  controllers: [
    MarketplaceController,
    MarketplaceRepositoriesController,

    PluginsController,
    PluginLifecycleController,
    PluginUninstallerController,
  ],

  providers: [
    MarketplaceRegistryService,
    MarketplaceRepositoriesService,
    MarketplaceCommunityRegistryService,

    PluginsService,
    PluginInstallerService,
    PluginLifecycleService,
    PluginUninstallerService,

    PluginUninstallationRecovery,
    PluginUninstallationCleanupService,

    PluginRecoveryLockService,
    PluginCleanupClaimService,
    PluginRecoveryFilesystemLockService,
    PluginRecoveryCoordinatorService,
  ],

  exports: [
    PluginsService,
    PluginInstallerService,
  ],
})
export class PluginsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        raw({
          type: 'application/zip',
          limit: MAX_PLUGIN_UPLOAD_BYTES,
          inflate: false,
        }),
      )
      .forRoutes({
        path: 'admin/plugins/install',
        method: RequestMethod.POST,
      });
  }
}