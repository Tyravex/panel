import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginUninstallationRecovery } from '../plugin-uninstallation-recovery';
import { getPluginStorageRoot } from '../plugin-storage.config';

jest.mock('node:fs/promises', () => ({
    lstat: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
}));

jest.mock('../plugin-storage.config', () => ({
    getPluginStorageRoot: jest.fn(),
}));

const ROOT = resolve('test', 'tyravex', 'plugins');
const QUARANTINE_ROOT = join(ROOT, '.uninstalling');

const PLUGIN_ID = 'tyravex.test.spanish';
const VERSION = '1.0.0';

const INSTALL_UUID = '11111111-1111-4111-8111-111111111111';
const OPERATION_UUID = '22222222-2222-4222-8222-222222222222';
const OTHER_UUID = '33333333-3333-4333-8333-333333333333';

const STORAGE_PATH = `${PLUGIN_ID}-${INSTALL_UUID}/package`;

const SOURCE_DIRECTORY = resolve(
    ROOT,
    `${PLUGIN_ID}-${INSTALL_UUID}`,
);

const QUARANTINE_DIRECTORY = join(
    QUARANTINE_ROOT,
    OPERATION_UUID,
);

const PACKAGE_DIRECTORY = join(
    QUARANTINE_DIRECTORY,
    'package',
);

const MANIFEST_PATH = join(
    PACKAGE_DIRECTORY,
    'manifest.json',
);

interface TestReservation {
    id: string;
    version: string;
    storagePath: string;
    uninstallOperationId: string | null;
}

const reservation: TestReservation = {
    id: PLUGIN_ID,
    version: VERSION,
    storagePath: STORAGE_PATH,
    uninstallOperationId: OPERATION_UUID,
};

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

describe('PluginUninstallationRecovery', () => {
    const pluginFindMany = jest.fn();
    const auditFindMany = jest.fn();

    const prisma = {
        plugin: {
            findMany: pluginFindMany,
        },
        adminAuditLog: {
            findMany: auditFindMany,
        },
    } as unknown as PrismaService;

    const recovery = new PluginUninstallationRecovery(prisma);

    const lstatMock = jest.mocked(lstat);
    const readdirMock = jest.mocked(readdir);
    const readFileMock = jest.mocked(readFile);

    const mockDirectoryEntries = (entries: string[]) => {
        readdirMock.mockResolvedValue(
            entries as unknown as Awaited<
                ReturnType<typeof readdir>
            >,
        );
    };

    const mockReservation = (
        overrides: Partial<typeof reservation> = {},
    ) => {
        pluginFindMany.mockResolvedValue([
            {
                ...reservation,
                ...overrides,
            },
        ]);
    };

    const mockCompletedAudit = (
        operationId = OPERATION_UUID,
    ) => {
        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: {
                    operationId,
                },
            },
        ]);
    };

    const mockQuarantine = () => {
        mockDirectoryEntries([OPERATION_UUID]);
    };

    const mockSourceExists = () => {
        const previousImplementation =
            lstatMock.getMockImplementation();

        lstatMock.mockImplementation(async (path) => {
            if (String(path) === SOURCE_DIRECTORY) {
                return directoryStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            if (previousImplementation) {
                return previousImplementation(path);
            }

            throw notFound();
        });
    };

    const findIssue = (
        issues: Array<{
            type: string;
            pluginId: string | null;
            directory: string | null;
            operationId?: string | null;
        }>,
        type: string,
    ) => issues.find((issue) => issue.type === type);

    beforeEach(() => {
        jest.resetAllMocks();

        jest.mocked(getPluginStorageRoot).mockReturnValue(ROOT);

        pluginFindMany.mockResolvedValue([]);
        auditFindMany.mockResolvedValue([]);

        mockDirectoryEntries([]);

        lstatMock.mockImplementation(async (path) => {
            const currentPath = String(path);

            if (
                currentPath === QUARANTINE_ROOT ||
                currentPath === QUARANTINE_DIRECTORY ||
                currentPath === PACKAGE_DIRECTORY
            ) {
                return directoryStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            if (currentPath === MANIFEST_PATH) {
                return fileStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            throw notFound();
        });

        readFileMock.mockResolvedValue(
            JSON.stringify({
                id: PLUGIN_ID,
                version: VERSION,
            }),
        );
    });

    it('returns a clean report when there are no pending operations', async () => {
        const report = await recovery.inspect();

        expect(report).toEqual({
            checkedAt: expect.any(String),
            issues: [],
            requiresManualReview: false,
        });

        expect(pluginFindMany).toHaveBeenCalledWith({
            where: {
                status: 'UNINSTALLING',
            },
            select: {
                id: true,
                version: true,
                storagePath: true,
                uninstallOperationId: true,
            },
        });

        expect(auditFindMany).not.toHaveBeenCalled();
    });

    it('detects a reservation whose source directory still exists', async () => {
        mockReservation();
        mockSourceExists();

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITH_SOURCE',
            pluginId: PLUGIN_ID,
            directory: SOURCE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('detects a reservation whose directory was moved to quarantine', async () => {
        mockReservation();
        mockQuarantine();

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITH_QUARANTINE',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });

        expect(
            findIssue(report.issues, 'QUARANTINE_WITHOUT_COMPLETED_AUDIT'),
        ).toBeUndefined();

        expect(auditFindMany).not.toHaveBeenCalled();
    });

    it('detects source and quarantine directories existing together', async () => {
        mockReservation();
        mockQuarantine();
        mockSourceExists();

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITH_BOTH_DIRECTORIES',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('detects a reservation with neither directory present', async () => {
        mockReservation();

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITHOUT_DIRECTORIES',
            pluginId: PLUGIN_ID,
            directory: null,
            operationId: OPERATION_UUID,
        });
    });

    it('detects a legacy reservation without an operation ID', async () => {
        mockReservation({
            uninstallOperationId: null,
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITHOUT_OPERATION_ID',
            pluginId: PLUGIN_ID,
            directory: SOURCE_DIRECTORY,
            operationId: null,
        });
    });

    it('detects a reservation with an invalid operation ID', async () => {
        mockReservation({
            uninstallOperationId: 'invalid-uuid',
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITHOUT_OPERATION_ID',
            pluginId: PLUGIN_ID,
            directory: SOURCE_DIRECTORY,
            operationId: 'invalid-uuid',
        });
    });

    it('does not trust a reservation with an invalid storage path', async () => {
        mockReservation({
            storagePath: '../outside/package',
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'RESERVATION_WITHOUT_DIRECTORIES',
            pluginId: PLUGIN_ID,
            directory: null,
            operationId: OPERATION_UUID,
        });
    });

    it('recognizes quarantine left after a completed uninstall', async () => {
        mockQuarantine();
        mockCompletedAudit();

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_WITH_COMPLETED_AUDIT',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
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
    });

    it('does not accept an audit with a different operation ID', async () => {
        mockQuarantine();
        mockCompletedAudit(OTHER_UUID);

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_WITHOUT_COMPLETED_AUDIT',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('does not accept an audit with missing metadata', async () => {
        mockQuarantine();

        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: null,
            },
        ]);

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_WITHOUT_COMPLETED_AUDIT',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('does not accept an audit with array metadata', async () => {
        mockQuarantine();

        auditFindMany.mockResolvedValue([
            {
                targetId: PLUGIN_ID,
                metadata: [OPERATION_UUID],
            },
        ]);

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_WITHOUT_COMPLETED_AUDIT',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('does not accept an audit belonging to another plugin', async () => {
        mockQuarantine();

        auditFindMany.mockResolvedValue([
            {
                targetId: 'another.plugin',
                metadata: {
                    operationId: OPERATION_UUID,
                },
            },
        ]);

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_WITHOUT_COMPLETED_AUDIT',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('detects quarantine without a completed audit', async () => {
        mockQuarantine();

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_WITHOUT_COMPLETED_AUDIT',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });

        expect(report.requiresManualReview).toBe(true);
    });

    it('detects a manifest identity mismatch for a reserved operation', async () => {
        mockReservation();
        mockQuarantine();

        readFileMock.mockResolvedValue(
            JSON.stringify({
                id: 'another.plugin',
                version: VERSION,
            }),
        );

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_IDENTITY_MISMATCH',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('detects a manifest version mismatch for a reserved operation', async () => {
        mockReservation();
        mockQuarantine();

        readFileMock.mockResolvedValue(
            JSON.stringify({
                id: PLUGIN_ID,
                version: '9.9.9',
            }),
        );

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'QUARANTINE_IDENTITY_MISMATCH',
            pluginId: PLUGIN_ID,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('rejects an unexpected quarantine entry name', async () => {
        mockDirectoryEntries(['unknown-directory']);

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'UNSAFE_QUARANTINE_ENTRY',
            pluginId: null,
            directory: join(
                QUARANTINE_ROOT,
                'unknown-directory',
            ),
            operationId: null,
        });

        expect(auditFindMany).not.toHaveBeenCalled();
    });

    it('rejects a symlinked quarantine root', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === QUARANTINE_ROOT) {
                return symlinkStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            throw notFound();
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'UNSAFE_QUARANTINE_ENTRY',
            pluginId: null,
            directory: QUARANTINE_ROOT,
            operationId: null,
        });

        expect(readdirMock).not.toHaveBeenCalled();
    });

    it('rejects a symlinked quarantine entry', async () => {
        mockQuarantine();

        lstatMock.mockImplementation(async (path) => {
            if (String(path) === QUARANTINE_ROOT) {
                return directoryStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            if (String(path) === QUARANTINE_DIRECTORY) {
                return symlinkStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            throw notFound();
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'UNSAFE_QUARANTINE_ENTRY',
            pluginId: null,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });

        expect(readFileMock).not.toHaveBeenCalled();
    });

    it('reports an unreadable quarantine root', async () => {
        lstatMock.mockRejectedValue(accessDenied());

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'UNREADABLE_QUARANTINE',
            pluginId: null,
            directory: QUARANTINE_ROOT,
            operationId: null,
        });
    });

    it('handles a missing quarantine root without error', async () => {
        lstatMock.mockRejectedValue(notFound());

        const report = await recovery.inspect();

        expect(report.issues).toEqual([]);
        expect(report.requiresManualReview).toBe(false);
    });

    it('rejects a missing package directory', async () => {
        mockQuarantine();

        lstatMock.mockImplementation(async (path) => {
            if (
                String(path) === QUARANTINE_ROOT ||
                String(path) === QUARANTINE_DIRECTORY
            ) {
                return directoryStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            throw notFound();
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'INVALID_QUARANTINE_PACKAGE',
            pluginId: null,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('rejects a missing manifest', async () => {
        mockQuarantine();

        readFileMock.mockRejectedValue(notFound());

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'INVALID_QUARANTINE_PACKAGE',
            pluginId: null,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('rejects malformed manifest JSON', async () => {
        mockQuarantine();

        readFileMock.mockResolvedValue('{invalid json');

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'INVALID_QUARANTINE_PACKAGE',
            pluginId: null,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });
    });

    it('rejects a symlinked manifest', async () => {
        mockQuarantine();

        lstatMock.mockImplementation(async (path) => {
            if (
                String(path) === QUARANTINE_ROOT ||
                String(path) === QUARANTINE_DIRECTORY ||
                String(path) === PACKAGE_DIRECTORY
            ) {
                return directoryStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            if (String(path) === MANIFEST_PATH) {
                return symlinkStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            throw notFound();
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'INVALID_QUARANTINE_PACKAGE',
            pluginId: null,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });

        expect(readFileMock).not.toHaveBeenCalled();
    });

    it('rejects an oversized manifest', async () => {
        mockQuarantine();

        lstatMock.mockImplementation(async (path) => {
            if (
                String(path) === QUARANTINE_ROOT ||
                String(path) === QUARANTINE_DIRECTORY ||
                String(path) === PACKAGE_DIRECTORY
            ) {
                return directoryStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            if (String(path) === MANIFEST_PATH) {
                return {
                    ...fileStats,
                    size: 65 * 1024,
                } as Awaited<ReturnType<typeof lstat>>;
            }

            throw notFound();
        });

        const report = await recovery.inspect();

        expect(report.issues).toContainEqual({
            type: 'INVALID_QUARANTINE_PACKAGE',
            pluginId: null,
            directory: QUARANTINE_DIRECTORY,
            operationId: OPERATION_UUID,
        });

        expect(readFileMock).not.toHaveBeenCalled();
    });

    it('does not mutate the filesystem or database', async () => {
        mockReservation();
        mockQuarantine();

        await recovery.inspect();

        expect(pluginFindMany).toHaveBeenCalledTimes(1);
        expect(auditFindMany).not.toHaveBeenCalled();

        const filesystem = jest.requireMock(
            'node:fs/promises',
        ) as Record<string, jest.Mock | undefined>;

        expect(filesystem.rename).toBeUndefined();
        expect(filesystem.rm).toBeUndefined();
        expect(filesystem.mkdir).toBeUndefined();
    });
});