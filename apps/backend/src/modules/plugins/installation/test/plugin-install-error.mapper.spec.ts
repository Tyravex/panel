import {
    BadRequestException,
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';

import { mapPluginInstallError } from '../plugin-install-error.mapper';

describe('Plugin install error mapping', () => {
    it('preserves invalid ZIP errors as HTTP 400', () => {
        const original = new BadRequestException(
            'Invalid plugin ZIP package.',
        );

        const mapped = mapPluginInstallError(original);

        expect(mapped).toBe(original);
        expect(mapped.getStatus()).toBe(400);
    });

    it('preserves installation conflicts as HTTP 409', () => {
        const original = new ConflictException(
            'Plugin is already registered.',
        );

        const mapped = mapPluginInstallError(original);

        expect(mapped).toBe(original);
        expect(mapped.getStatus()).toBe(409);
    });

    it('maps unexpected errors to HTTP 500', () => {
        const mapped = mapPluginInstallError(
            new Error('Private database connection details'),
        );

        expect(mapped).toBeInstanceOf(
            InternalServerErrorException,
        );
        expect(mapped.getStatus()).toBe(500);
        expect(mapped.message).toBe(
            'Plugin installation failed.',
        );
        expect(mapped.message).not.toContain('database');
    });

    it('handles unknown thrown values safely', () => {
        const mapped = mapPluginInstallError(null);

        expect(mapped.getStatus()).toBe(500);
        expect(mapped.message).toBe(
            'Plugin installation failed.',
        );
    });
});