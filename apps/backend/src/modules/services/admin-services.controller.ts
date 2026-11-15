import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { AdminServicesService } from './admin-services.service';
import { ServicesService } from './services.service';
import { CreateAdminServiceDto, UpdateAdminServiceDto } from './dto/admin-service.dto';
import { SetServiceOwnerDto } from './dto/set-service-owner.dto';
import { ServiceEnvironmentService } from './configuration/service-environment.service';
import { ServiceCompatibilityService } from './configuration/service-compatibility.service';

@Controller('admin/services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminServicesController {
  constructor(private readonly admin: AdminServicesService, private readonly services: ServicesService,
    private readonly environment: ServiceEnvironmentService, private readonly compatibility: ServiceCompatibilityService) {}
  @Get() @Permissions('service:read:any') list() { return this.admin.list(); }
  @Get('available-eggs') @Permissions('service:read:any') eggs() { return this.services.getAvailableEggs(); }
  @Get(':id') @Permissions('service:read:any') get(@Param('id') id: string) { return this.admin.get(id); }
  @Get(':id/environment') @Permissions('service:read:any') environmentMetadata(@Param('id') id: string) { return this.environment.metadata(id); }
  @Patch(':id/environment') @Permissions('service:manage:any') environmentUpdate(@Req() req: { user: { id: number } }, @Param('id') id: string, @Body() body: unknown) { return this.environment.update(req.user.id, id, body); }
  @Get(':id/compatibility') @Permissions('service:read:any') installationCompatibility(@Param('id') id: string) { return this.compatibility.get(id); }
  @Get(':id/egg-updates') @Permissions('service:read:any') eggUpdates(@Param('id') id: string) { return this.compatibility.updates(id); }
  @Post() @Permissions('service:create') create(@Req() req: { user: { id: number } }, @Body() dto: CreateAdminServiceDto) { return this.admin.save(req.user.id, dto); }
  @Patch(':id') @Permissions('service:manage:any') update(@Req() req: { user: { id: number } }, @Param('id') id: string, @Body() dto: UpdateAdminServiceDto) { return this.admin.save(req.user.id, dto, id); }
  @Patch(':id/owner') @Permissions('service:transfer:any') owner(@Req() req: { user: { id: number } }, @Param('id') id: string, @Body() dto: SetServiceOwnerDto) { return this.services.setOwner(id, req.user.id, dto); }
  @Post(':id/prepare-install') @Permissions('service:install:any') prepare(@Req() req: { user: { id: number } }, @Param('id') id: string) { return this.services.prepareInstall(id, req.user.id, true); }
}
