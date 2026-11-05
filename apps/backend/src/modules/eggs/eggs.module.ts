import { Module } from '@nestjs/common';

import {
    EggsController,
    EggStatusController,
} from './eggs.controller';

import { EggLibraryController } from './egg-library.controller';
import { EggsService } from './eggs.service';

@Module({
    controllers: [
        EggsController,
        EggStatusController,
        EggLibraryController,
    ],
    providers: [EggsService],
})
export class EggsModule { }