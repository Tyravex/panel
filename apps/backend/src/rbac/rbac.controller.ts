import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
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

    @Delete('users/:userId/roles/:roleId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async revokeRole(
        @Param('userId', ParseIntPipe) userId: number,
        @Param('roleId') roleId: string,
    ): Promise<void> {
        await this.rbacService.revokeRole(userId, roleId);
    }
}