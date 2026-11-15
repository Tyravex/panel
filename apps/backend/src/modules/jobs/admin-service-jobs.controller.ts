import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { ServiceJobsService } from './service-jobs.service';

@Controller('admin/services/:id/jobs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminServiceJobsController {
  constructor(private readonly jobs: ServiceJobsService) {}
  @Get() @Permissions('service:read:any') history(@Param('id') id: string) { return this.jobs.getHistory(id); }
  @Get('active') @Permissions('service:read:any') active(@Req() req: { user: { id: number } }, @Param('id') id: string) { return this.jobs.getActive(req.user.id, id, true); }
  @Post('install') @Permissions('service:install:any') install(@Req() req: { user: { id: number } }, @Param('id') id: string) { return this.jobs.create(req.user.id, id, JobType.INSTALL, true); }
}
