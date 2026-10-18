import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from './decorators/permissions.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';

type AdminRequest = { user: { id: number } };

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('role:manage')
export class RbacController {
    constructor(private readonly rbacService: RbacService) { }

    @Get('permissions')
    listPermissions() { return this.rbacService.listPermissions(); }

    @Post('roles')
    createRole(@Body() body: { name?: string; permissionIds?: string[] }, @Req() req: AdminRequest) {
        return this.rbacService.createRole(body, req.user.id);
    }

    @Patch('roles/:roleId')
    updateRole(@Param('roleId') roleId: string, @Body() body: { name?: string; permissionIds?: string[] }, @Req() req: AdminRequest) {
        return this.rbacService.updateRole(roleId, body, req.user.id);
    }

    @Delete('roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteRole(@Param('roleId') roleId: string, @Req() req: AdminRequest): Promise<void> {
        await this.rbacService.deleteRole(roleId, req.user.id);
    }

    @Get('roles')
    listRoles() { return this.rbacService.listRoles(); }

    @Get('users/:userId/roles')
    listUserRoles(@Param('userId', ParseIntPipe) userId: number) { return this.rbacService.listUserRoles(userId); }

    @Post('users/:userId/roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async assignRole(@Param('userId', ParseIntPipe) userId: number, @Param('roleId') roleId: string, @Req() req: AdminRequest): Promise<void> {
        await this.rbacService.assignRole(userId, roleId, req.user.id);
    }

    @Delete('users/:userId/roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async revokeRole(@Param('userId', ParseIntPipe) userId: number, @Param('roleId') roleId: string, @Req() req: AdminRequest): Promise<void> {
        await this.rbacService.revokeRole(userId, roleId, req.user.id);
    }
}
