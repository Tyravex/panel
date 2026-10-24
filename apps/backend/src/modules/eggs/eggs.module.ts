import { Module } from '@nestjs/common';

import {
    EggsController,
    EggStatusController,
} from './eggs.controller';
import { EggsService } from './eggs.service';

@Module({
    controllers: [EggsController, EggStatusController],
    providers: [EggsService],
})
export class EggsModule { }
