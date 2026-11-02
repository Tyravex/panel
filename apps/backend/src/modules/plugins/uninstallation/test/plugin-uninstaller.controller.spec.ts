import {
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';

import { PluginUninstallerController } from '../plugin-uninstaller.controller';
import { PluginUninstallerService } from '../plugin-uninstaller.service';

describe('PluginUninstallerController', () => {
    const uninstall = jest.fn();

    let controller: PluginUninstallerController;

    beforeEach(() => {
        jest.clearAllMocks();

        uninstall.mockResolvedValue({
            id: 'tyravex.test.spanish',
            removed: true,
            cleanupPending: false,
        });

        controller = new PluginUninstallerController(
            {
                uninstall,
            } as unknown as PluginUninstallerService,
        );
    });

    const request = (
        user?: {
            id?: number | string;
            userId?: number | string;
        },
    ) =>
        ({
            user,
        }) as Parameters<
            PluginUninstallerController['uninstall']
        >[2];

    it('uninstalls a confirmed plugin', async () => {
        const result = await controller.uninstall(
            'tyravex.test.spanish',
            {
                confirmId: 'tyravex.test.spanish',
            },
            request({ id: 7 }),
        );

        expect(uninstall).toHaveBeenCalledWith(
            'tyravex.test.spanish',
            7,
        );

        expect(result).toEqual({
            id: 'tyravex.test.spanish',
            removed: true,
            cleanupPending: false,
        });
    });

    it('accepts a numeric userId string', async () => {
        await controller.uninstall(
            'tyravex.test.spanish',
            {
                confirmId: 'tyravex.test.spanish',
            },
            request({ userId: '12' }),
        );

        expect(uninstall).toHaveBeenCalledWith(
            'tyravex.test.spanish',
            12,
        );
    });

    it('rejects a mismatched confirmation', () => {
        expect(() =>
            controller.uninstall(
                'tyravex.test.spanish',
                {
                    confirmId: 'another.plugin',
                },
                request({ id: 7 }),
            ),
        ).toThrow(BadRequestException);

        expect(uninstall).not.toHaveBeenCalled();
    });

    it('rejects a missing confirmation', () => {
        expect(() =>
            controller.uninstall(
                'tyravex.test.spanish',
                {},
                request({ id: 7 }),
            ),
        ).toThrow(BadRequestException);

        expect(uninstall).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated actor', () => {
        expect(() =>
            controller.uninstall(
                'tyravex.test.spanish',
                {
                    confirmId: 'tyravex.test.spanish',
                },
                request(),
            ),
        ).toThrow(UnauthorizedException);

        expect(uninstall).not.toHaveBeenCalled();
    });

    it.each([
        0,
        -1,
        1.5,
        '0',
        '-1',
        '1.5',
        'invalid',
    ])('rejects invalid actor ID %s', (id) => {
        expect(() =>
            controller.uninstall(
                'tyravex.test.spanish',
                {
                    confirmId: 'tyravex.test.spanish',
                },
                request({ id }),
            ),
        ).toThrow(UnauthorizedException);

        expect(uninstall).not.toHaveBeenCalled();
    });
});
