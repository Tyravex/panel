import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RbacController } from '../rbac.controller';
import { RbacService } from '../rbac.service';
import { DefaultRoleService } from '../default-role.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';

describe('RbacController', () => {
    const revokeRole = jest.fn();

    let controller: RbacController;

    beforeEach(() => {
        jest.clearAllMocks();

        controller = new RbacController({
            revokeRole,
        } as unknown as RbacService, {
            getDefaultRole: jest.fn(),
            listEligibleDefaultRoles: jest.fn(),
            setDefaultRole: jest.fn(),
        } as unknown as DefaultRoleService);
    });

    it('requires JWT authentication and permissions guard', () => {
        const guards = Reflect.getMetadata(
            GUARDS_METADATA,
            RbacController,
        );

        expect(guards).toContain(JwtAuthGuard);
        expect(guards).toContain(PermissionsGuard);
    });

    it('requires role:manage permission', () => {
        const permissions = Reflect.getMetadata(
            'permissions',
            RbacController,
        );

        expect(permissions).toEqual(['role:manage']);
    });

    it('delegates role revocation to RbacService', async () => {
        revokeRole.mockResolvedValue(undefined);

        await controller.revokeRole(1, 'role-id', { user: { id: 7 } });

        expect(revokeRole).toHaveBeenCalledWith(1, 'role-id', 7);
        expect(revokeRole).toHaveBeenCalledTimes(1);
    });
});