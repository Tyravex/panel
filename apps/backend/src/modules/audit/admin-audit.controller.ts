import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { AdminAuditService } from './admin-audit.service';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('role:manage')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.audit.list(page, action, actorId);
  }
}