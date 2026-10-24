import { mapServiceInstallPayload } from '../service-install-payload.mapper';

describe('mapServiceInstallPayload', () => {
    const createJob = () => ({
        id: 'job-1',
        serviceId: 'service-1',
        type: 'INSTALL',
        installConfig: {
            formatVersion: 1,
            egg: {
                id: 'egg-1',
                key: 'nodejs-discord-bot',
                version: '1.0.0',
            },
            nodeId: 'node-1',
            runtime: {
                image: 'node:22-bookworm-slim',
                startup: 'node index.js',
            },
            resources: {
                memoryMb: 512,
                cpuPercent: 10,
                diskMb: 512,
            },
            variables: [
                {
                    name: 'BOT_TOKEN',
                    required: true,
                    secret: true,
                },
            ],
        },
    });

    it('maps a valid snapshot to the transport contract', () => {
        const payload = mapServiceInstallPayload(
            createJob(),
            'node-1',
        );

        expect(payload).toEqual({
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
            variables: [
                {
                    key: 'BOT_TOKEN',
                    required: true,
                },
            ],
        });

        expect(JSON.stringify(payload)).not.toContain('"secret"');
    });

    it('rejects a mismatched node', () => {
        expect(() =>
            mapServiceInstallPayload(createJob(), 'node-2'),
        ).toThrow('Invalid installation snapshot');
    });

    it('rejects a job for another operation', () => {
        expect(() =>
            mapServiceInstallPayload(
                { ...createJob(), type: 'RESTART' },
                'node-1',
            ),
        ).toThrow('Invalid service installation job');
    });

    it('rejects an unsupported snapshot version', () => {
        const job = createJob();
        job.installConfig.formatVersion = 2;

        expect(() =>
            mapServiceInstallPayload(job, 'node-1'),
        ).toThrow('Invalid installation snapshot');
    });

    it('rejects unknown snapshot fields', () => {
        const job = createJob();

        expect(() =>
            mapServiceInstallPayload(
                {
                    ...job,
                    installConfig: {
                        ...job.installConfig,
                        command: 'unexpected',
                    },
                },
                'node-1',
            ),
        ).toThrow('Invalid installation snapshot');
    });

    it('rejects secret values in variable metadata', () => {
        const job = createJob();

        expect(() =>
            mapServiceInstallPayload(
                {
                    ...job,
                    installConfig: {
                        ...job.installConfig,
                        variables: [
                            {
                                name: 'BOT_TOKEN',
                                required: true,
                                secret: true,
                                value: 'sensitive-value',
                            },
                        ],
                    },
                },
                'node-1',
            ),
        ).toThrow('Invalid installation variable metadata');
    });

    it('rejects invalid resource limits', () => {
        const job = createJob();
        job.installConfig.resources.memoryMb = -1;

        expect(() =>
            mapServiceInstallPayload(job, 'node-1'),
        ).toThrow('Invalid service installation payload');
    });

    it('rejects missing installation snapshot', () => {
        expect(() =>
            mapServiceInstallPayload(
                { ...createJob(), installConfig: null },
                'node-1',
            ),
        ).toThrow('Invalid installation snapshot');
    });
});