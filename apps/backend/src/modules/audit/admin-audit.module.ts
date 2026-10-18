import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminAuditController],
  providers: [AdminAuditService, PrismaService],
})
export class AdminAuditModule {}