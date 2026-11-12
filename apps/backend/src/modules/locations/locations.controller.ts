import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('node:manage')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) { }

  @Get()
  findAll() {
    return this.locationsService.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateLocationDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.locationsService.createLocation(req.user.id, dto);
  }
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: { user: { id: number } },
  ) {
    return this.locationsService.deleteLocation(req.user.id, id);
  }
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.locationsService.updateLocation(req.user.id, id, dto);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findById(id);
  }
}
