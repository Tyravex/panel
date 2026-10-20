import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';
import { PluginsModule } from '@/modules/plugins/plugins.module';

import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';

@Module({
  imports: [
    PrismaModule,
    PluginsModule,
  ],
  controllers: [LanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
