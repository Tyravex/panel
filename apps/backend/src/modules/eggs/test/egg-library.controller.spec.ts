import { ForbiddenException } from '@nestjs/common';

import { EggLibraryController } from '../egg-library.controller';
import { EggsService } from '../eggs.service';

describe('EggLibraryController', () => {
    const listLibraryEggs = jest.fn();
    const getLibraryEgg = jest.fn();
    const getLibraryStats = jest.fn();

    let controller: EggLibraryController;

    const actor = (
        roles: string[],
        permissions: string[],
    ) =>
        ({
            user: {
                id: 1,
                roles,
                permissions,
            },
        }) as any;

    const admin = () =>
        actor(['Administrator'], ['egg:read']);

    beforeEach(() => {
        jest.resetAllMocks();

        controller = new EggLibraryController({
            listLibraryEggs,
            getLibraryEgg,
            getLibraryStats,
        } as unknown as EggsService);
    });

    it('rejects users without administrative permissions', () => {
        expect(() =>
            controller.list(
                actor(['User'], []),
            ),
        ).toThrow(ForbiddenException);

        expect(listLibraryEggs).not.toHaveBeenCalled();
    });

    it('allows non-Owner users with read permission', () => {
        controller.stats(
            actor(['Support'], ['egg:read']),
        );

        expect(getLibraryStats).toHaveBeenCalledTimes(1);
    });

    it('rejects management permission without read permission', () => {
        expect(() =>
            controller.stats(
                actor(['Administrator'], ['service:manage:any']),
            ),
        ).toThrow(ForbiddenException);

        expect(getLibraryStats).not.toHaveBeenCalled();
    });

    it('passes search and pagination to the service', () => {
        controller.list(admin(), 'discord', '2', '10');

        expect(listLibraryEggs).toHaveBeenCalledWith({
            query: 'discord',
            page: '2',
            pageSize: '10',
        });
    });

    it('allows administrators to retrieve statistics', () => {
        controller.stats(admin());

        expect(getLibraryStats).toHaveBeenCalledTimes(1);
    });

    it('allows administrators to retrieve Egg details', () => {
        controller.details(admin(), 'egg-123');

        expect(getLibraryEgg).toHaveBeenCalledWith('egg-123');
    });

    it('rejects unauthorized Egg detail access', () => {
        expect(() =>
            controller.details(actor(['User'], []), 'egg-123'),
        ).toThrow(ForbiddenException);

        expect(getLibraryEgg).not.toHaveBeenCalled();
    });
});
