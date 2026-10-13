import { Module } from '@nestjs/common';
import { StatusService } from './status.service';
import { StatusController } from './status.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [],
  providers: [StatusService, PrismaModule],
  controllers: [StatusController],
})

export class StatusModule {}