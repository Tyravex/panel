import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserDTO } from '@shared/types';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface AuthenticatedRequest {
    user?: UserDTO;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions =
            this.reflector.getAllAndOverride<string[]>(
                PERMISSIONS_KEY,
                [context.getHandler(), context.getClass()],
            );

        // Endpoints without @Permissions() have no additional
        // permission requirements.
        if (!requiredPermissions?.length) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();

        const userPermissions = request.user?.permissions;

        // Fail closed if authentication data is missing.
        if (!Array.isArray(userPermissions)) {
            return false;
        }

        // All declared permissions are required.
        return requiredPermissions.every((permission) =>
            userPermissions.includes(permission),
        );
    }
}