import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from './decorators/permissions.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';
import { DefaultRoleService } from './default-role.service';

type AdminRequest = { user: { id: number } };

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('role:manage')
export class RbacController {
    constructor(
        private readonly rbacService: RbacService,
        private readonly defaultRoleService: DefaultRoleService,
    ) { }

    @Get('default-role')
    @Permissions('settings:read')
    getDefaultRole() {
        return this.defaultRoleService.getDefaultRole();
    }

    @Get('default-role/eligible')
    @Permissions('settings:read')
    listEligibleDefaultRoles() {
        return this.defaultRoleService.listEligibleDefaultRoles();
    }

    @Patch('default-role')
    @Permissions('settings:manage')
    updateDefaultRole(
        @Body() body: unknown,
        @Req() req: AdminRequest,
    ) {
        if (
            !body ||
            typeof body !== 'object' ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !Object.prototype.hasOwnProperty.call(body, 'roleId') ||
            typeof (body as { roleId?: unknown }).roleId !== 'string' ||
            !(body as { roleId: string }).roleId.trim()
        ) {
            throw new BadRequestException('Expected a non-empty roleId string only');
        }

        return this.defaultRoleService.setDefaultRole(
            (body as { roleId: string }).roleId,
            req.user.id,
        );
    }
    @Get('permissions')
    @Permissions('role:read')
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
    @Permissions('role:read')
    listRoles() { return this.rbacService.listRoles(); }

    @Get('roles/:roleId')
    @Permissions('role:read')
    getRole(@Param('roleId') roleId: string) { return this.rbacService.getRole(roleId); }

    @Get('users/:userId/roles')
    @Permissions('role:read')
    listUserRoles(@Param('userId', ParseIntPipe) userId: number) { return this.rbacService.listUserRoles(userId); }

    @Post('users/:userId/roles/:roleId')
    @Permissions('role:assign')
    @HttpCode(HttpStatus.NO_CONTENT)
    async assignRole(@Param('userId', ParseIntPipe) userId: number, @Param('roleId') roleId: string, @Req() req: AdminRequest): Promise<void> {
        await this.rbacService.assignRole(userId, roleId, req.user.id);
    }

    @Delete('users/:userId/roles/:roleId')
    @Permissions('role:assign')
    @HttpCode(HttpStatus.NO_CONTENT)
    async revokeRole(@Param('userId', ParseIntPipe) userId: number, @Param('roleId') roleId: string, @Req() req: AdminRequest): Promise<void> {
        await this.rbacService.revokeRole(userId, roleId, req.user.id);
    }
}
