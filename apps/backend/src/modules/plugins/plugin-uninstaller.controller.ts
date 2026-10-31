import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Param,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { PluginUninstallerService } from './plugin-uninstaller.service';

interface UninstallRequest {
    confirmId?: string;
}

interface AuthenticatedRequest extends Request {
    user?: {
        id?: number | string;
        userId?: number | string;
    };
}

@Controller('admin/plugins')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('plugin:manage')
export class PluginUninstallerController {
    constructor(
        private readonly uninstaller: PluginUninstallerService,
    ) { }

    @Delete(':id')
    uninstall(
        @Param('id') id: string,
        @Body() body: UninstallRequest,
        @Req() request: AuthenticatedRequest,
    ) {
        if (body?.confirmId !== id) {
            throw new BadRequestException(
                'Plugin ID confirmation does not match.',
            );
        }

        const rawId =
            request.user?.id ?? request.user?.userId;

        const actorId =
            typeof rawId === 'number'
                ? rawId
                : typeof rawId === 'string' &&
                    /^[1-9]\d*$/.test(rawId)
                    ? Number(rawId)
                    : NaN;

        if (
            !Number.isSafeInteger(actorId) ||
            actorId <= 0
        ) {
            throw new UnauthorizedException(
                'Administrator identity is unavailable.',
            );
        }

        return this.uninstaller.uninstall(id, actorId);
    }
}
