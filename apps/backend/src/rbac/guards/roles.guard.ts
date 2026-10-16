import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserDTO } from '@shared/types';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles =
            this.reflector.getAllAndOverride<string[]>(
                ROLES_KEY,
                [
                    context.getHandler(),
                    context.getClass(),
                ],
            );

        if (!requiredRoles?.length) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user as UserDTO | undefined;

        // Deny access unless authentication established valid roles.
        if (!user || !Array.isArray(user.roles)) {
            return false;
        }

        // At least one assigned role must match a required role.
        return requiredRoles.some((role) =>
            user.roles.includes(role),
        );
    }
}