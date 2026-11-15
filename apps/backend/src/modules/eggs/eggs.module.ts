import { Module } from '@nestjs/common';

import {
    EggsController,
    EggStatusController,
} from './eggs.controller';

import { EggLibraryController } from './egg-library.controller';
import { EggsService } from './eggs.service';
import { AdminEggsController } from './admin-eggs.controller';
import { EggRepositorySyncService } from './egg-repository-sync.service';
import { RemoteJsonService } from '@/infrastructure/http/remote-json.service';
import { EggCatalogController } from './catalog/egg-catalog.controller';
import { EggTagsController } from './catalog/egg-tags.controller';
import { EggTagsService } from './catalog/egg-tags.service';
import { EggLibraryQueryService } from './catalog/egg-library-query.service';
import { EggRepositoryArchiveService } from './catalog/egg-repository-archive.service';
import { EggUpdateSettingsController } from './settings/egg-update-settings.controller';
import { EggUpdateSettingsService } from './settings/egg-update-settings.service';
import { OfficialEggUpdateService } from './settings/official-egg-update.service';
import { OfficialEggUpdateWorker } from './settings/official-egg-update.worker';

@Module({
    controllers: [
        EggsController,
        EggStatusController,
        EggLibraryController,
        AdminEggsController,
        EggCatalogController, EggTagsController, EggUpdateSettingsController,
    ],
    providers: [EggsService, EggRepositorySyncService, RemoteJsonService, EggTagsService, EggLibraryQueryService, EggRepositoryArchiveService,
      EggUpdateSettingsService, OfficialEggUpdateService, OfficialEggUpdateWorker],
})
export class EggsModule { }
