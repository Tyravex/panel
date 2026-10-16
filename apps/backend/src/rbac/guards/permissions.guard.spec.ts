import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

describe('PermissionsGuard', () => {
    const reflector = new Reflector();
    const guard = new PermissionsGuard(reflector);

    class TestController {
        testEndpoint() {}
    }

    const createContext = (
        permissions?: string[],
        requiredPermissions?: string[],
    ): ExecutionContext => {
        Reflect.defineMetadata(
            PERMISSIONS_KEY,
            requiredPermissions,
            TestController.prototype.testEndpoint,
        );

        return {
            getHandler: () => TestController.prototype.testEndpoint,
            getClass: () => TestController,
            switchToHttp: () => ({
                getRequest: () => ({
                    user: permissions === undefined
                        ? undefined
                        : { permissions },
                }),
            }),
        } as unknown as ExecutionContext;
    };

    it('allows endpoints without permission requirements', () => {
        expect(
            guard.canActivate(createContext([], undefined)),
        ).toBe(true);
    });

    it('allows users with the required permission', () => {
        expect(
            guard.canActivate(
                createContext(['node:manage'], ['node:manage']),
            ),
        ).toBe(true);
    });

    it('rejects users without the required permission', () => {
        expect(
            guard.canActivate(
                createContext(['server:create'], ['node:manage']),
            ),
        ).toBe(false);
    });

    it('rejects requests without authenticated user data', () => {
        expect(
            guard.canActivate(
                createContext(undefined, ['node:manage']),
            ),
        ).toBe(false);
    });

    it('requires all declared permissions', () => {
        expect(
            guard.canActivate(
                createContext(
                    ['node:manage'],
                    ['node:manage', 'server:create'],
                ),
            ),
        ).toBe(false);

        expect(
            guard.canActivate(
                createContext(
                    ['node:manage', 'server:create'],
                    ['node:manage', 'server:create'],
                ),
            ),
        ).toBe(true);
    });
});