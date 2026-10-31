import {
    BadRequestException,
    UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';

import { PluginInstallerService } from '../plugin-installer.service';
import { PluginsController } from '../plugins.controller';
import { PluginsService } from '../plugins.service';

describe('PluginsController', () => {
    const pluginsService = {
        listForAdmin: jest.fn(),
        getForAdmin: jest.fn(),
    };

    const installer = {
        installLanguagePackage: jest.fn(),
    };

    let controller: PluginsController;

    const makeRequest = (
        body: unknown,
        contentType = 'application/zip',
    ): Request =>
        ({
            body,
            is: jest.fn((type: string) =>
                type === contentType ? contentType : false,
            ),
        }) as unknown as Request;

    beforeEach(() => {
        jest.clearAllMocks();

        controller = new PluginsController(
            pluginsService as unknown as PluginsService,
            installer as unknown as PluginInstallerService,
        );
    });

    it('installs a valid ZIP request', async () => {
        const archive = Buffer.from('zip-fixture');

        const result = {
            id: 'example.language',
            type: 'LANGUAGE',
            version: '1.0.0',
            status: 'INSTALLED',
        };

        installer.installLanguagePackage.mockResolvedValue(result);

        await expect(
            controller.install(makeRequest(archive)),
        ).resolves.toEqual(result);

        expect(
            installer.installLanguagePackage,
        ).toHaveBeenCalledWith(archive);
    });

    it('rejects an unsupported content type', async () => {
        await expect(
            controller.install(
                makeRequest(Buffer.from('data'), 'application/json'),
            ),
        ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

        expect(
            installer.installLanguagePackage,
        ).not.toHaveBeenCalled();
    });

    it('rejects an empty archive', async () => {
        await expect(
            controller.install(makeRequest(Buffer.alloc(0))),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(
            installer.installLanguagePackage,
        ).not.toHaveBeenCalled();
    });

    it('rejects an unparsed request body', async () => {
        await expect(
            controller.install(makeRequest(undefined)),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(
            installer.installLanguagePackage,
        ).not.toHaveBeenCalled();
    });

    it('preserves the existing plugin listing endpoint', () => {
        const plugins = [
            {
                id: 'example.language',
                status: 'INSTALLED',
            },
        ];

        pluginsService.listForAdmin.mockReturnValue(plugins);

        expect(controller.list()).toEqual(plugins);
        expect(pluginsService.listForAdmin).toHaveBeenCalledTimes(1);
    });

    it('preserves the existing plugin details endpoint', async () => {
        const plugin = {
            id: 'example.language',
            status: 'INSTALLED',
        };

        pluginsService.getForAdmin.mockResolvedValue(plugin);

        await expect(
            controller.getOne('example.language'),
        ).resolves.toEqual(plugin);

        expect(pluginsService.getForAdmin).toHaveBeenCalledWith(
            'example.language',
        );
    });
});
