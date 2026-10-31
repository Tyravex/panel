import {
    lstat,
    mkdir,
    readFile,
    readdir,
    rename,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginCleanupClaimService } from '../plugin-cleanup-claim.service';
import { getPluginStorageRoot } from '../plugin-storage.config';

jest.mock('node:fs/promises', () => ({
    lstat: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    rename: jest.fn(),
}));

jest.mock('node:crypto', () => ({
    randomUUID: jest.fn(),
}));

jest.mock('../plugin-storage.config', () => ({
    getPluginStorageRoot: jest.fn(),
}));

const OPERATION_ID = '11111111-2222-4333-8444-555555555555';
const CLAIM_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const STORAGE_ROOT = resolve('test', 'plugin-storage');

const QUARANTINE_ROOT = join(
    STORAGE_ROOT,
    '.uninstalling',
);

const CLEANUP_ROOT = join(
    STORAGE_ROOT,
    '.cleanup',
);

const SOURCE = join(
    QUARANTINE_ROOT,
    OPERATION_ID,
);

const DESTINATION = join(
    CLEANUP_ROOT,
    `${OPERATION_ID}-${CLAIM_ID}`,
);

const PACKAGE_DIRECTORY = join(
    SOURCE,
    'package',
);
const DIRECTORY_STATS = {
    isDirectory: () => true,
    isSymbolicLink: () => false,
    isFile: () => false,
    size: 0,
};

const FILE_STATS = {
    isDirectory: () => false,
    isSymbolicLink: () => false,
    isFile: () => true,
    size: 128,
};

const SYMLINK_STATS = {
    isDirectory: () => false,
    isSymbolicLink: () => true,
    isFile: () => false,
    size: 0,
};

const MANIFEST = JSON.stringify({
    id: 'tyravex.test.example',
    version: '1.0.0',
});

describe('PluginCleanupClaimService', () => {
    const lstatMock = jest.mocked(lstat);
    const mkdirMock = jest.mocked(mkdir);
    const readFileMock = jest.mocked(readFile);
    const readdirMock = jest.mocked(readdir);
    const renameMock = jest.mocked(rename);
    const randomUUIDMock = jest.mocked(randomUUID);
    const storageRootMock = jest.mocked(getPluginStorageRoot);

    const pluginFindUnique = jest.fn();
    const auditFindMany = jest.fn();

    const prisma = {
        plugin: {
            findUnique: pluginFindUnique,
        },
        adminAuditLog: {
            findMany: auditFindMany,
        },
    } as unknown as PrismaService;

    const service = new PluginCleanupClaimService(prisma);

    beforeEach(() => {
        jest.resetAllMocks();

        storageRootMock.mockReturnValue(STORAGE_ROOT);
        randomUUIDMock.mockReturnValue(CLAIM_ID);

        lstatMock.mockImplementation(async (path) => {
            if (String(path).endsWith('manifest.json')) {
                return FILE_STATS as never;
            }

            return DIRECTORY_STATS as never;
        });

        mkdirMock.mockResolvedValue(undefined);
        readdirMock.mockResolvedValue([OPERATION_ID] as never);
        readFileMock.mockResolvedValue(MANIFEST as never);
        renameMock.mockResolvedValue(undefined);

        pluginFindUnique.mockResolvedValue(null);

        auditFindMany.mockResolvedValue([
            {
                metadata: {
                    operationId: OPERATION_ID,
                    version: '1.0.0',
                },
            },
        ]);
    });

    it('claims a completed uninstall confirmed by the database', async () => {
        const report = await service.claimPending();

        expect(report).toEqual({
            checked: 1,
            claimed: 1,
            skipped: 0,
            failed: 0,
        });

        expect(pluginFindUnique).toHaveBeenCalledWith({
            where: {
                id: 'tyravex.test.example',
            },
            select: {
                id: true,
            },
        });

        expect(auditFindMany).toHaveBeenCalledWith({
            where: {
                action: 'plugin.uninstalled',
                targetType: 'Plugin',
                targetId: 'tyravex.test.example',
            },
            select: {
                metadata: true,
            },
        });

        expect(renameMock).toHaveBeenCalledWith(
            SOURCE,
            DESTINATION,
        );
    });

    it('does not claim when the plugin is still registered', async () => {
        pluginFindUnique.mockResolvedValue({
            id: 'tyravex.test.example',
        });

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(report.claimed).toBe(0);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('does not claim without a matching uninstall audit', async () => {
        auditFindMany.mockResolvedValue([]);

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects an audit with a different operation ID', async () => {
        auditFindMany.mockResolvedValue([
            {
                metadata: {
                    operationId: '99999999-2222-4333-8444-555555555555',
                    version: '1.0.0',
                },
            },
        ]);

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects an audit with a different version', async () => {
        auditFindMany.mockResolvedValue([
            {
                metadata: {
                    operationId: OPERATION_ID,
                    version: '2.0.0',
                },
            },
        ]);

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects malformed audit metadata', async () => {
        auditFindMany.mockResolvedValue([
            { metadata: null },
            { metadata: 'invalid' },
            { metadata: [] },
        ]);

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('ignores entries that are not UUIDs', async () => {
        readdirMock.mockResolvedValue([
            'not-an-operation',
        ] as never);

        const report = await service.claimPending();

        expect(report).toEqual({
            checked: 1,
            claimed: 0,
            skipped: 1,
            failed: 0,
        });

        expect(pluginFindUnique).not.toHaveBeenCalled();
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked operation directory', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === SOURCE) {
                return SYMLINK_STATS as never;
            }

            if (String(path).endsWith('manifest.json')) {
                return FILE_STATS as never;
            }

            return DIRECTORY_STATS as never;
        });

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked package directory', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === PACKAGE_DIRECTORY) {
                return SYMLINK_STATS as never;
            }

            if (String(path).endsWith('manifest.json')) {
                return FILE_STATS as never;
            }

            return DIRECTORY_STATS as never;
        });

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked manifest', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path).endsWith('manifest.json')) {
                return SYMLINK_STATS as never;
            }

            return DIRECTORY_STATS as never;
        });

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects a manifest exceeding the size limit', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path).endsWith('manifest.json')) {
                return {
                    ...FILE_STATS,
                    size: 64 * 1024 + 1,
                } as never;
            }

            return DIRECTORY_STATS as never;
        });

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects malformed manifest JSON', async () => {
        readFileMock.mockResolvedValue('{invalid' as never);

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('rejects a manifest without a valid identity', async () => {
        readFileMock.mockResolvedValue(
            JSON.stringify({
                id: '',
                version: '1.0.0',
            }) as never,
        );

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('does not claim when the storage root is missing', async () => {
        lstatMock.mockRejectedValue(
            Object.assign(new Error('Missing'), {
                code: 'ENOENT',
            }),
        );

        const report = await service.claimPending();

        expect(report.checked).toBe(0);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('does not claim when the cleanup root is a symlink', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === CLEANUP_ROOT) {
                return SYMLINK_STATS as never;
            }

            if (String(path).endsWith('manifest.json')) {
                return FILE_STATS as never;
            }

            return DIRECTORY_STATS as never;
        });

        const report = await service.claimPending();

        expect(report.checked).toBe(0);
        expect(renameMock).not.toHaveBeenCalled();
    });

    it('reports a rename failure without claiming the operation', async () => {
        renameMock.mockRejectedValue(
            Object.assign(new Error('Access denied'), {
                code: 'EACCES',
            }),
        );

        const report = await service.claimPending();

        expect(report).toEqual({
            checked: 1,
            claimed: 0,
            skipped: 0,
            failed: 1,
        });
    });

    it('skips an operation removed by another process', async () => {
        renameMock.mockRejectedValue(
            Object.assign(new Error('Not found'), {
                code: 'ENOENT',
            }),
        );

        const report = await service.claimPending();

        expect(report.skipped).toBe(1);
        expect(report.failed).toBe(0);
    });

    it('is idempotent when quarantine is empty on the next run', async () => {
        const first = await service.claimPending();

        readdirMock.mockResolvedValue([] as never);

        const second = await service.claimPending();

        expect(first.claimed).toBe(1);
        expect(second).toEqual({
            checked: 0,
            claimed: 0,
            skipped: 0,
            failed: 0,
        });

        expect(renameMock).toHaveBeenCalledTimes(1);
    });

    it('never deletes plugin files', async () => {
        await service.claimPending();

        expect(renameMock).toHaveBeenCalledTimes(1);
    });
});