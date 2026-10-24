import {
    isServiceInstallPayload,
    ServiceInstallPayload,
} from '../service-install-payload';

describe('ServiceInstallPayload validation', () => {
    const validPayload: ServiceInstallPayload = {
        formatVersion: 1,
        serviceId: 'service-1',
        jobId: 'job-1',
        nodeId: 'node-1',
        egg: {
            id: 'egg-1',
            key: 'nodejs-discord-bot',
            version: '1.0.0',
        },
        runtime: {
            image: 'node:22-bookworm-slim',
            startup: 'node index.js',
        },
        resources: {
            memoryMb: 512,
            cpuPercent: 10,
            diskMb: 512,
        },
        variables: [],
    };

    it('accepts a valid installation payload', () => {
        expect(isServiceInstallPayload(validPayload)).toBe(true);
    });

    it('rejects unsupported format versions', () => {
        expect(
            isServiceInstallPayload({
                ...validPayload,
                formatVersion: 2,
            }),
        ).toBe(false);
    });

    it('rejects missing identifiers', () => {
        expect(
            isServiceInstallPayload({
                ...validPayload,
                serviceId: '',
            }),
        ).toBe(false);
    });

    it('rejects unexpected fields', () => {
        expect(
            isServiceInstallPayload({
                ...validPayload,
                shellCommand: 'rm -rf /',
            }),
        ).toBe(false);
    });

    it('rejects invalid resource limits', () => {
        expect(
            isServiceInstallPayload({
                ...validPayload,
                resources: {
                    ...validPayload.resources,
                    memoryMb: -1,
                },
            }),
        ).toBe(false);

        expect(
            isServiceInstallPayload({
                ...validPayload,
                resources: {
                    ...validPayload.resources,
                    cpuPercent: 101,
                },
            }),
        ).toBe(false);
    });

    it('rejects variables containing secret values', () => {
        expect(
            isServiceInstallPayload({
                ...validPayload,
                variables: [
                    {
                        key: 'BOT_TOKEN',
                        required: true,
                        value: 'secret',
                    },
                ],
            }),
        ).toBe(false);
    });

    it('rejects duplicate variable keys', () => {
        expect(
            isServiceInstallPayload({
                ...validPayload,
                variables: [
                    { key: 'BOT_TOKEN', required: true },
                    { key: 'BOT_TOKEN', required: false },
                ],
            }),
        ).toBe(false);
    });

    it('rejects null, arrays and primitive values', () => {
        expect(isServiceInstallPayload(null)).toBe(false);
        expect(isServiceInstallPayload([])).toBe(false);
        expect(isServiceInstallPayload('install')).toBe(false);
    });
});