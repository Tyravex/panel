import { randomUUID } from 'node:crypto';
import {
    lstat,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginCleanupClaimService } from '../plugin-cleanup-claim.service';
import { PluginUninstallationCleanupService } from '../plugin-uninstallation-cleanup.service';
import { getPluginStorageRoot } from '../plugin-storage.config';

jest.mock('node:crypto', () => ({
    randomUUID: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
    lstat: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    rename: jest.fn(),
    rm: jest.fn(),
}));

jest.mock('../plugin-storage.config', () => ({
    getPluginStorageRoot: jest.fn(),
}));

const ROOT = resolve('test', 'plugin-cleanup-integration');
const QUARANTINE_ROOT = join(ROOT, '.uninstalling');
const CLEANUP_ROOT = join(ROOT, '.cleanup');

const OPERATION_ID = '11111111-2222-4333-8444-555555555555';
const CLAIM_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const PLUGIN_ID = 'tyravex.test.example';
const VERSION = '1.0.0';

const CLAIM_NAME = `${OPERATION_ID}-${CLAIM_ID}`;

const QUARANTINE_DIRECTORY = join(
    QUARANTINE_ROOT,
    OPERATION_ID,
);

const CLAIM_DIRECTORY = join(
    CLEANUP_ROOT,
    CLAIM_NAME,
);

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
    size: 128,
};

const manifest = JSON.stringify({
    id: PLUGIN_ID,
    version: VERSION,
});

describe('Plugin cleanup integration', () => {
    const lstatMock = jest.mocked(lstat);
    const mkdirMock = jest.mocked(mkdir);
    const readFileMock = jest.mocked(readFile);
    const readdirMock = jest.mocked(readdir);
    const renameMock = jest.mocked(rename);
    const rmMock = jest.mocked(rm);

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

    const claim = new PluginCleanupClaimService(prisma);

    const cleanup = new PluginUninstallationCleanupService(
        prisma,
    );

    beforeEach(() => {
        jest.resetAllMocks();

        jest.mocked(getPluginStorageRoot).mockReturnValue(ROOT);
        jest.mocked(randomUUID).mockReturnValue(CLAIM_ID);

        lstatMock.mockImplementation(async (path) => {
            if (String(path).endsWith('manifest.json')) {
                return fileStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            return directoryStats as Awaited<
                ReturnType<typeof lstat>
            >;
        });

        mkdirMock.mockResolvedValue(undefined);
        readFileMock.mockResolvedValue(manifest as never);
        renameMock.mockResolvedValue(undefined);
        rmMock.mockResolvedValue(undefined);

        pluginFindUnique.mockResolvedValue(null);

        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: {
                    operationId: OPERATION_ID,
                    version: VERSION,
                },
            },
        ]);

        readdirMock.mockImplementation(async (path) => {
            if (String(path) === QUARANTINE_ROOT) {
                return [OPERATION_ID] as never;
            }

            if (String(path) === CLEANUP_ROOT) {
                return [CLAIM_NAME] as never;
            }

            return [] as never;
        });
    });

    it('recognizes a claim name containing two UUIDs', () => {
        const uuidSource =
            '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

        const pattern = new RegExp(
            `^(${uuidSource})-(${uuidSource})$`,
            'i',
        );

        const match = pattern.exec(CLAIM_NAME);

        expect(match).not.toBeNull();
        expect(match?.[1]).toBe(OPERATION_ID);
        expect(match?.[2]).toBe(CLAIM_ID);
    });

    it('claims a completed uninstall before cleanup removes it', async () => {
        const claimed = await claim.claimPending();

        expect(claimed.claimed).toBe(1);

        expect(renameMock).toHaveBeenCalledWith(
            QUARANTINE_DIRECTORY,
            CLAIM_DIRECTORY,
        );

        expect(rmMock).not.toHaveBeenCalled();

        const cleaned = await cleanup.cleanupCompleted();

        expect(cleaned).toEqual({
            checked: 1,
            removed: 1,
            skipped: 0,
            failed: 0,
        });

        expect(rmMock).toHaveBeenCalledWith(
            CLAIM_DIRECTORY,
            {
                recursive: true,
                force: false,
            },
        );
    });

    it('never deletes directly from quarantine', async () => {
        await cleanup.cleanupCompleted();

        for (const [path] of rmMock.mock.calls) {
            expect(
                String(path).startsWith(QUARANTINE_ROOT),
            ).toBe(false);
        }
    });

    it('does not remove an unclaimed quarantine directory', async () => {
        readdirMock.mockImplementation(async (path) => {
            if (String(path) === CLEANUP_ROOT) {
                return [] as never;
            }

            if (String(path) === QUARANTINE_ROOT) {
                return [OPERATION_ID] as never;
            }

            return [] as never;
        });

        const report = await cleanup.cleanupCompleted();

        expect(report).toEqual({
            checked: 0,
            removed: 0,
            skipped: 0,
            failed: 0,
        });

        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does not delete when the plugin is registered again', async () => {
        pluginFindUnique.mockResolvedValue({
            id: PLUGIN_ID,
        });

        const report = await cleanup.cleanupCompleted();

        expect(report.checked).toBe(1);
        expect(report.removed).toBe(0);
        expect(report.skipped).toBe(1);

        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does not delete without a matching audit', async () => {
        auditFindMany.mockResolvedValue([]);

        const report = await cleanup.cleanupCompleted();

        expect(report.checked).toBe(1);
        expect(report.removed).toBe(0);
        expect(report.skipped).toBe(1);

        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does not delete when audit operation ID differs', async () => {
        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: {
                    operationId:
                        '99999999-9999-4999-8999-999999999999',
                    version: VERSION,
                },
            },
        ]);

        const report = await cleanup.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('does not delete when audit version differs', async () => {
        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: {
                    operationId: OPERATION_ID,
                    version: '9.9.9',
                },
            },
        ]);

        const report = await cleanup.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('ignores an invalid cleanup directory name', async () => {
        readdirMock.mockImplementation(async (path) => {
            if (String(path) === CLEANUP_ROOT) {
                return ['unrelated-directory'] as never;
            }

            return [] as never;
        });

        const report = await cleanup.cleanupCompleted();

        expect(report).toEqual({
            checked: 1,
            removed: 0,
            skipped: 1,
            failed: 0,
        });

        expect(rmMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked claimed directory', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === CLAIM_DIRECTORY) {
                return {
                    isDirectory: () => false,
                    isSymbolicLink: () => true,
                    isFile: () => false,
                    size: 0,
                } as Awaited<ReturnType<typeof lstat>>;
            }

            if (String(path).endsWith('manifest.json')) {
                return fileStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            return directoryStats as Awaited<
                ReturnType<typeof lstat>
            >;
        });

        const report = await cleanup.cleanupCompleted();

        expect(report.skipped).toBe(1);
        expect(rmMock).not.toHaveBeenCalled();
    });

    it('reports filesystem deletion errors', async () => {
        rmMock.mockRejectedValue(
            Object.assign(new Error('Access denied'), {
                code: 'EACCES',
            }),
        );

        const report = await cleanup.cleanupCompleted();

        expect(report).toEqual({
            checked: 1,
            removed: 0,
            skipped: 0,
            failed: 1,
        });
    });

    it('can inspect an existing claim after a simulated restart', async () => {
        const report = await cleanup.cleanupCompleted();

        expect(report).toEqual({
            checked: 1,
            removed: 1,
            skipped: 0,
            failed: 0,
        });

        expect(renameMock).not.toHaveBeenCalled();

        expect(rmMock).toHaveBeenCalledWith(
            CLAIM_DIRECTORY,
            {
                recursive: true,
                force: false,
            },
        );
    });

    it('does not delete when the cleanup directory is empty', async () => {
        readdirMock.mockImplementation(async (path) => {
            if (String(path) === CLEANUP_ROOT) {
                return [] as never;
            }

            return [] as never;
        });

        const report = await cleanup.cleanupCompleted();

        expect(report).toEqual({
            checked: 0,
            removed: 0,
            skipped: 0,
            failed: 0,
        });

        expect(rmMock).not.toHaveBeenCalled();
    });
});