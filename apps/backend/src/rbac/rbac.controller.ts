import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Patch,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from './decorators/permissions.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('role:manage')
export class RbacController {
    constructor(private readonly rbacService: RbacService) {}

    @Get('permissions')
    listPermissions() {
        return this.rbacService.listPermissions();
    }

    @Post('roles')
    createRole(@Body() body: { name?: string; permissionIds?: string[] }) {
        return this.rbacService.createRole(body);
    }

    @Patch('roles/:roleId')
    updateRole(@Param('roleId') roleId: string, @Body() body: { name?: string; permissionIds?: string[] }) {
        return this.rbacService.updateRole(roleId, body);
    }

    @Delete('roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteRole(@Param('roleId') roleId: string): Promise<void> {
        await this.rbacService.deleteRole(roleId);
    }

    @Get('roles')
    listRoles() {
        return this.rbacService.listRoles();
    }

    @Get('users/:userId/roles')
    listUserRoles(@Param('userId', ParseIntPipe) userId: number) {
        return this.rbacService.listUserRoles(userId);
    }

    @Post('users/:userId/roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async assignRole(
        @Param('userId', ParseIntPipe) userId: number,
        @Param('roleId') roleId: string,
    ): Promise<void> {
        await this.rbacService.assignRole(userId, roleId);
    }

    @Delete('users/:userId/roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async revokeRole(
        @Param('userId', ParseIntPipe) userId: number,
        @Param('roleId') roleId: string,
    ): Promise<void> {
        await this.rbacService.revokeRole(userId, roleId);
    }
}
