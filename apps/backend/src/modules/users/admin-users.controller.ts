import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @Permissions('user:read')
  list(@Query('page') page?: string, @Query('search') search?: string, @Query('status') status?: string) {
    return this.users.list(page, search, status);
  }

  @Get(':id')
  @Permissions('user:read')
  get(@Param('id', ParseIntPipe) id: number) { return this.users.get(id); }

  @Post()
  @Permissions('user:manage')
  create(@Body() body: { username?: string; email?: string; password?: string }, @Req() req: { user: { id: number } }) {
    return this.users.create(body, req.user.id);
  }

  @Patch(':id')
  @Permissions('user:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { username?: string; email?: string }, @Req() req: { user: { id: number } }) {
    return this.users.update(id, body, req.user.id);
  }

  @Patch(':id/status')
  @Permissions('user:manage')
  setActive(@Param('id', ParseIntPipe) id: number, @Body() body: { isActive?: boolean }, @Req() req: { user: { id: number } }) {
    return this.users.setActive(id, body?.isActive, req.user.id);
  }
}
