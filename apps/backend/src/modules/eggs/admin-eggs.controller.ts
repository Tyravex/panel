import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { EggsService } from './eggs.service';
import { EggRepositorySyncService } from './egg-repository-sync.service';

class UpdateRepositoryDto { @IsString() @Length(1, 100) name!: string; }

@Controller('admin/eggs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminEggsController {
  constructor(private readonly eggs: EggsService, private readonly sync: EggRepositorySyncService) {}
  @Post('validate') @Permissions('egg:read') validate(@Body() manifest: unknown) { return this.eggs.validateManifest(manifest); }
  @Get(':id/manifest') @Permissions('egg:read') manifest(@Param('id') id: string) { return this.eggs.getManifest(id); }
  @Post(':id/versions') @Permissions('egg:manage') version(@Req() req: { user: { id: number } }, @Param('id') id: string, @Body() manifest: unknown) { return this.eggs.createVersion(req.user.id, id, manifest); }
  @Patch('repositories/:id') @Permissions('egg-repository:manage') repository(@Req() req: { user: { id: number } }, @Param('id') id: string, @Body() body: UpdateRepositoryDto) { return this.eggs.renameRepository(req.user.id, id, body.name); }
  @Post('repositories/:id/preview') @Permissions('egg-repository:sync') preview(@Param('id') id: string) { return this.sync.preview(id); }
  @Post('repositories/:id/sync') @Permissions('egg-repository:sync', 'egg:import') synchronize(@Req() req: { user: { id: number } }, @Param('id') id: string, @Body() body: { paths?: string[]; digest?: string }) { return this.sync.sync(req.user.id, id, body?.paths ?? [], body?.digest); }
}
