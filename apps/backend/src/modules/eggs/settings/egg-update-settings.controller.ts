import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { EggUpdateSettingsService } from './egg-update-settings.service';
import { OfficialEggUpdateService } from './official-egg-update.service';

@Controller('admin/egg-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EggUpdateSettingsController {
  constructor(private readonly settings: EggUpdateSettingsService, private readonly updates: OfficialEggUpdateService) {}
  @Get() @Permissions('settings:read') get() { return this.settings.get(); }
  @Patch() @Permissions('settings:manage', 'egg-repository:sync', 'egg:import') update(@Req() req: { user: { id: number } }, @Body() body: unknown) { return this.settings.update(req.user.id, body); }
  @Post(':id/check') @Permissions('egg:read', 'egg-repository:sync') check(@Param('id') id: string) { return this.updates.refresh(id); }
}
