import {
    Controller,
    Header,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { Permissions } from '@/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';

import { PluginLifecycleService } from './plugin-lifecycle.service';

interface AuthenticatedRequest extends Request {
    user?: {
        id?: number | string;
        userId?: number | string;
    };
}

@Controller('admin/plugins')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('plugin:manage')
export class PluginLifecycleController {
    constructor(
        private readonly lifecycle: PluginLifecycleService,
    ) { }

    @Post(':id/enable')
    @Header('Cache-Control', 'no-store')
    enable(
        @Param('id') id: string,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.lifecycle.enable(
            id,
            this.getActorId(request),
        );
    }

    @Post(':id/disable')
    @Header('Cache-Control', 'no-store')
    disable(
        @Param('id') id: string,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.lifecycle.disable(
            id,
            this.getActorId(request),
        );
    }

    private getActorId(
        request: AuthenticatedRequest,
    ): number {
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

        return actorId;
    }
}