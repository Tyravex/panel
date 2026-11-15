import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionsService } from './regions.service';

@Controller('regions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('region:manage')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) { }

  @Get()
  findAll() {
    return this.regionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.regionsService.findById(id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: { user: { id: number } },
  ) {
    return this.regionsService.deleteRegion(req.user.id, id);
  }
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRegionDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.regionsService.updateRegion(req.user.id, id, dto);
  }
  @Post()
  create(
    @Body() dto: CreateRegionDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.regionsService.createRegion(req.user.id, dto);
  }
}
