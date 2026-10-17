import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('user:read')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query('page') page?: string, @Query('search') search?: string) {
    return this.users.list(page, search);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.users.get(id);
  }
}
