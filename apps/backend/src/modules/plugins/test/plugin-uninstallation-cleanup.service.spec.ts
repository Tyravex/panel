import {
    lstat,
    readdir,
    readFile,
    rm,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginUninstallationCleanupService } from '../plugin-uninstallation-cleanup.service';
import { getPluginStorageRoot } from '../plugin-storage.config';

jest.mock('node:fs/promises', () => ({
    lstat: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    rm: jest.fn(),
}));

jest.mock('../plugin-storage.config', () => ({
    getPluginStorageRoot: jest.fn(),
}));

const ROOT = resolve('test', 'tyravex', 'plugins');
const CLEANUP_ROOT = join(ROOT, '.cleanup');

const PLUGIN_ID = 'tyravex.test.spanish';
const VERSION = '1.0.0';

const OPERATION_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_OPERATION_ID = '33333333-3333-4333-8333-333333333333';

const CLAIM_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CLAIM_NAME = `${OPERATION_ID}-${CLAIM_ID}`;

const DIRECTORY = join(CLEANUP_ROOT, CLAIM_NAME);
const PACKAGE_DIRECTORY = join(DIRECTORY, 'package');
const MANIFEST_PATH = join(PACKAGE_DIRECTORY, 'manifest.json');

const directoryStats = {
    isDirectory: () => true,
    isSymbolicLink: () => false,
    isFile: () => false,
    size: 0,
};

const fileStats = {
    isDirectory: () => false,
    isSymbolicLink: () => false,
    isFile: () => true,
    size: 100,
};

const symlinkStats = {
    isDirectory: () => false,
    isSymbolicLink: () => true,
    isFile: () => false,
    size: 0,
};

const notFound = () =>
    Object.assign(new Error('Not found'), {
        code: 'ENOENT',
    });

const accessDenied = () =>
    Object.assign(new Error('Access denied'), {
        code: 'EACCES',
    });

describe('PluginUninstallationCleanupService', () => {
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

    const service = new PluginUninstallationCleanupService(prisma);

    const lstatMock = jest.mocked(lstat);
    const readdirMock = jest.mocked(readdir);
    const readFileMock = jest.mocked(readFile);
    const rmMock = jest.mocked(rm);

    const setEntries = (entries: string[]) => {
        readdirMock.mockResolvedValue(
            entries as unknown as Awaited<ReturnType<typeof readdir>>,
        );
    };

    const setCompletedAudit = (
        operationId = OPERATION_ID,
        version = VERSION,
    ) => {
        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: {
                    operationId,
                    version,
                },
            },
        ]);
    };

    beforeEach(() => {
        jest.resetAllMocks();

        jest.mocked(getPluginStorageRoot).mockReturnValue(ROOT);

        pluginFindUnique.mockResolvedValue(null);
        auditFindMany.mockResolvedValue([]);

        setEntries([CLAIM_NAME]);

        lstatMock.mockImplementation(async (path) => {
            const currentPath = String(path);

            if (
                currentPath === ROOT ||
                currentPath === CLEANUP_ROOT ||
                currentPath === DIRECTORY ||
                currentPath === PACKAGE_DIRECTORY
            ) {
                return directoryStats as Awaited<ReturnType<typeof lstat>>;
            }

            if (currentPath === MANIFEST_PATH) {
                return fileStats as Awaited<ReturnType<typeof lstat>>;
            }

            throw notFound();
        });

        readFileMock.mockResolvedValue(
            JSON.stringify({
                id: PLUGIN_ID,
                version: VERSION,
            }),
        );

        rmMock.mockResolvedValue(undefined);
    });

    it('removes claimed cleanup after a verified completed uninstall', async () => {
        setCompletedAudit();

        const report = await service.cleanupCompleted();

        expect(report).toEqual({
            checked: 1,
            removed: 1,
            skipped: 0,
            failed: 0,
        });

        expect(pluginFindUnique).toHaveBeenCalledWith({
            where: {
                id: PLUGIN_ID,
            },
            select: {
                id: true,
            },
        });

        expect(auditFindMany).toHaveBeenCalledWith({
            where: {
                action: 'plugin.uninstalled',
                targetType: 'Plugin',
                targetId: PLUGIN_ID,
            },
            select: {
                targetId: true,
                metadata: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100,
        });

        expect(rmMock).toHaveBeenCalledWith(DIRECTORY, {
            recursive: true,
            force: false,
        });
    });

    it('does not remove claimed cleanup without a completed audit', async () => {
        const report = await service.cleanupCompleted();

        expect(report).toEqual({
            checked: 1,
            removed: 0,
            skipped: 1,
            failed: 0,
        });

        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does not remove claimed cleanup if the plugin still exists', async () => {
        pluginFindUnique.mockResolvedValue({
            id: PLUGIN_ID,
        });

        setCompletedAudit();

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(report.removed).toBe(0);

        expect(auditFindMany).not.toHaveBeenCalled();
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects an audit with a different operation ID', async () => {
        setCompletedAudit(OTHER_OPERATION_ID);

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects an audit with a different plugin version', async () => {
        setCompletedAudit(OPERATION_ID, '9.9.9');

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects audit metadata that is not an object', async () => {
        auditFindMany.mockResolvedValue([
            { metadata: null },
            { metadata: [OPERATION_ID] },
            { metadata: 'invalid' },
        ]);

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('ignores entries without UUID names', async () => {
        setEntries(['unexpected-directory', '../outside']);

        const report = await service.cleanupCompleted();

        expect(report).toEqual({
            checked: 2,
            removed: 0,
            skipped: 2,
            failed: 0,
        });

        expect(pluginFindUnique).not.toHaveBeenCalled();
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked claimed cleanup directory', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === DIRECTORY) {
                return symlinkStats as Awaited<ReturnType<typeof lstat>>;
            }

            return directoryStats as Awaited<ReturnType<typeof lstat>>;
        });

        setCompletedAudit();

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(readFileMock).not.toHaveBeenCalled();
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked manifest', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === MANIFEST_PATH) {
                return symlinkStats as Awaited<ReturnType<typeof lstat>>;
            }

            return directoryStats as Awaited<ReturnType<typeof lstat>>;
        });

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(readFileMock).not.toHaveBeenCalled();
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects malformed manifest JSON', async () => {
        readFileMock.mockResolvedValue('{invalid json');

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects an oversized manifest', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === MANIFEST_PATH) {
                return {
                    ...fileStats,
                    size: 65 * 1024,
                } as Awaited<ReturnType<typeof lstat>>;
            }

            return directoryStats as Awaited<ReturnType<typeof lstat>>;
        });

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(readFileMock).not.toHaveBeenCalled();
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does nothing when the storage root is missing', async () => {
        lstatMock.mockRejectedValue(notFound());

        const report = await service.cleanupCompleted();

        expect(report).toEqual({
            checked: 0,
            removed: 0,
            skipped: 0,
            failed: 0,
        });

        expect(readdirMock).not.toHaveBeenCalled();
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does nothing when claimed cleanup cannot be enumerated', async () => {
        readdirMock.mockRejectedValue(accessDenied());

        const report = await service.cleanupCompleted();

        expect(report.checked).toBe(0);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('reports deletion failures without throwing', async () => {
        setCompletedAudit();
        rmMock.mockRejectedValue(accessDenied());

        const report = await service.cleanupCompleted();

        expect(report).toEqual({
            checked: 1,
            removed: 0,
            skipped: 0,
            failed: 1,
        });
    });

    it('does not delete when claimed cleanup disappears before cleanup', async () => {
        setCompletedAudit();

        let cleanupRootChecks = 0;

        lstatMock.mockImplementation(async (path) => {
            const currentPath = String(path);

            if (currentPath === CLEANUP_ROOT) {
                cleanupRootChecks += 1;

                if (cleanupRootChecks > 1) {
                    throw notFound();
                }
            }

            if (currentPath === MANIFEST_PATH) {
                return fileStats as Awaited<ReturnType<typeof lstat>>;
            }

            return directoryStats as Awaited<ReturnType<typeof lstat>>;
        });

        const report = await service.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('is idempotent when cleanup directory is empty on the next run', async () => {
        setCompletedAudit();

        const first = await service.cleanupCompleted();

        expect(first.removed).toBe(1);

        setEntries([]);

        const second = await service.cleanupCompleted();

        expect(second).toEqual({
            checked: 0,
            removed: 0,
            skipped: 0,
            failed: 0,
        });

        expect(rmMock).toHaveBeenCalledTimes(1);
    });
});
