import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { EggLibraryQueryService } from './egg-library-query.service';
import { EggRepositoryArchiveService } from './egg-repository-archive.service';
import { PrismaService } from '@/prisma/prisma.service';
import { newerEggVersion } from './egg-system-tags';

@Controller('admin/egg-catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EggCatalogController {
  constructor(private readonly library: EggLibraryQueryService, private readonly archive: EggRepositoryArchiveService, private readonly prisma: PrismaService) {}
  @Get() @Permissions('egg:read') list(@Req() req: { user: { id: number } }, @Query() filters: { query?: string; page?: string; category?: string; tag?: string }) { return this.library.list(req.user.id, filters); }
  @Post('repositories/:id/archive') @Permissions('egg-repository:manage') archiveRepository(@Req() req: { user: { id: number } }, @Param('id') id: string) { return this.archive.archive(id, req.user.id); }
  @Get(':id/versions') @Permissions('egg:read') async versions(@Param('id') id: string) {
    const current = await this.prisma.egg.findUnique({ where: { id }, select: { repositoryId: true, key: true } });
    if (!current) return [];
    const versions = await this.prisma.egg.findMany({ where: current, select: { id: true, version: true, approvalStatus: true, isEnabled: true, createdAt: true } });
    return versions.sort((a, b) => newerEggVersion(a.version, b.version) ? -1 : newerEggVersion(b.version, a.version) ? 1 : 0);
  }
}
