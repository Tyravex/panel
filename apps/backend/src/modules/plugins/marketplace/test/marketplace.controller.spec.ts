import 'reflect-metadata';

import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/rbac/guards/permissions.guard';
import { PERMISSIONS_KEY } from '@/rbac/decorators/permissions.decorator';

import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceRegistryService } from '../marketplace-registry.service';

describe('MarketplaceController', () => {
    const registry = {
        schemaVersion: 1 as const,
        plugins: [],
    };

    it('returns the official marketplace registry', async () => {
        const getOfficialRegistry = jest.fn().mockResolvedValue(registry);

        const controller = new MarketplaceController({
            getOfficialRegistry,
        } as unknown as MarketplaceRegistryService);

        await expect(controller.list()).resolves.toEqual(registry);
        expect(getOfficialRegistry).toHaveBeenCalledTimes(1);
    });

    it('has authentication and permission guards', () => {
        const guards = Reflect.getMetadata(
            GUARDS_METADATA,
            MarketplaceController,
        ) as unknown[];

        expect(guards).toContain(JwtAuthGuard);
        expect(guards).toContain(PermissionsGuard);
    });

    it('requires plugin:manage permission', () => {
        const permissions = Reflect.getMetadata(
            PERMISSIONS_KEY,
            MarketplaceController,
        ) as string[];

        expect(permissions).toEqual(['plugin:manage']);
    });
});