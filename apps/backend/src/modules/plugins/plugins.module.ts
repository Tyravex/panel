import { Module } from '@nestjs/common';

import { PrismaModule } from '@/prisma/prisma.module';

import { PluginsService } from './plugins.service';

@Module({
  imports: [PrismaModule],
  providers: [PluginsService],
  exports: [PluginsService],
})
export class PluginsModule {}
