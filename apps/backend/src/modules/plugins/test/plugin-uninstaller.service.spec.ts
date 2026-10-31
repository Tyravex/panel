import {
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { lstat, mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PrismaService } from '@/prisma/prisma.service';

import { PluginUninstallerService } from '../plugin-uninstaller.service';
import { getPluginStorageRoot } from '../plugin-storage.config';

jest.mock('node:fs/promises', () => ({
    lstat: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    rm: jest.fn(),
}));

jest.mock('../plugin-storage.config', () => ({
    getPluginStorageRoot: jest.fn(),
}));

const ROOT = resolve('test', 'tyravex', 'plugins');
const PLUGIN_ID = 'tyravex.test.spanish';
const VERSION = '1.0.0';
const INSTALL_UUID = '11111111-1111-4111-8111-111111111111';

const STORAGE_PATH = `${PLUGIN_ID}-${INSTALL_UUID}/package`;
const SOURCE_DIRECTORY = resolve(ROOT, `${PLUGIN_ID}-${INSTALL_UUID}`);
const QUARANTINE_ROOT = join(ROOT, '.uninstalling');

const ACTOR_ID = 7;

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const directoryStats = {
    isDirectory: () => true,
    isSymbolicLink: () => false,
};

const symlinkStats = {
    isDirectory: () => false,
    isSymbolicLink: () => true,
};

const pluginRecord = {
    id: PLUGIN_ID,
    type: 'LANGUAGE',
    version: VERSION,
    status: 'INSTALLED',
    storagePath: STORAGE_PATH,
    uninstallOperationId: null,
};

describe('PluginUninstallerService', () => {
    const findUnique = jest.fn();
    const updateMany = jest.fn();
    const transaction = jest.fn();

    const txFindUnique = jest.fn();
    const txLanguageFindMany = jest.fn();
    const txLanguageDeleteMany = jest.fn();
    const txPluginDeleteMany = jest.fn();
    const txAuditCreate = jest.fn();

    const transactionClient = {
        plugin: {
            findUnique: txFindUnique,
            deleteMany: txPluginDeleteMany,
        },
        language: {
            findMany: txLanguageFindMany,
            deleteMany: txLanguageDeleteMany,
        },
        adminAuditLog: {
            create: txAuditCreate,
        },
    };

    const prisma = {
        plugin: {
            findUnique,
            updateMany,
        },
        $transaction: transaction,
    } as unknown as PrismaService;

    const service = new PluginUninstallerService(prisma);

    const lstatMock = jest.mocked(lstat);
    const mkdirMock = jest.mocked(mkdir);
    const renameMock = jest.mocked(rename);
    const rmMock = jest.mocked(rm);

    const getReservation = () => {
        const call = updateMany.mock.calls.find(
            ([args]) => args?.data?.status === 'UNINSTALLING',
        );

        expect(call).toBeDefined();

        const args = call![0] as {
            where: Record<string, unknown>;
            data: {
                status: string;
                uninstallOperationId: string;
            };
        };

        return args;
    };

    const getOperationId = (): string => {
        const operationId =
            getReservation().data.uninstallOperationId;

        expect(operationId).toMatch(UUID_PATTERN);

        return operationId;
    };

    const getQuarantineDirectory = (): string =>
        join(QUARANTINE_ROOT, getOperationId());

    beforeEach(() => {
        jest.resetAllMocks();

        jest.mocked(getPluginStorageRoot).mockReturnValue(ROOT);

        findUnique.mockResolvedValue({
            ...pluginRecord,
        });

        updateMany.mockResolvedValue({
            count: 1,
        });

        txFindUnique.mockImplementation(async () => ({
            status: 'UNINSTALLING',
            version: VERSION,
            storagePath: STORAGE_PATH,
            uninstallOperationId: getOperationId(),
        }));

        txLanguageFindMany.mockResolvedValue([
            {
                code: 'es',
                isBuiltIn: false,
                isFallback: false,
            },
        ]);

        txLanguageDeleteMany.mockResolvedValue({
            count: 1,
        });

        txPluginDeleteMany.mockResolvedValue({
            count: 1,
        });

        txAuditCreate.mockResolvedValue({
            id: 1,
        });

        transaction.mockImplementation(
            async (callback: (tx: typeof transactionClient) => unknown) =>
                callback(transactionClient),
        );

        lstatMock.mockResolvedValue(
            directoryStats as Awaited<ReturnType<typeof lstat>>,
        );

        mkdirMock.mockResolvedValue(undefined);
        renameMock.mockResolvedValue(undefined);
        rmMock.mockResolvedValue(undefined);
    });

    it('uninstalls a plugin successfully', async () => {
        const result = await service.uninstall(PLUGIN_ID, ACTOR_ID);

        expect(result).toEqual({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: false,
        });

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(txPluginDeleteMany).toHaveBeenCalledTimes(1);
        expect(rmMock).toHaveBeenCalledTimes(1);
    });

    it('persists a UUID together with the UNINSTALLING status', async () => {
        await service.uninstall(PLUGIN_ID, ACTOR_ID);

        const reservation = getReservation();
        const operationId = getOperationId();

        expect(reservation.where).toEqual({
            id: PLUGIN_ID,
            version: VERSION,
            status: 'INSTALLED',
            storagePath: STORAGE_PATH,
            uninstallOperationId: null,
        });

        expect(reservation.data).toEqual({
            status: 'UNINSTALLING',
            uninstallOperationId: operationId,
        });
    });

    it('uses the persisted UUID as the quarantine directory name', async () => {
        await service.uninstall(PLUGIN_ID, ACTOR_ID);

        const quarantine = getQuarantineDirectory();

        expect(mkdirMock).toHaveBeenCalledWith(
            QUARANTINE_ROOT,
            {
                recursive: true,
                mode: 0o700,
            },
        );

        expect(renameMock).toHaveBeenCalledWith(
            SOURCE_DIRECTORY,
            quarantine,
        );

        expect(rmMock).toHaveBeenCalledWith(
            quarantine,
            {
                recursive: true,
                force: false,
            },
        );
    });

    it('checks the operation ID before committing deletion', async () => {
        await service.uninstall(PLUGIN_ID, ACTOR_ID);

        expect(txPluginDeleteMany).toHaveBeenCalledWith({
            where: {
                id: PLUGIN_ID,
                status: 'UNINSTALLING',
                version: VERSION,
                storagePath: STORAGE_PATH,
                uninstallOperationId: getOperationId(),
            },
        });
    });

    it('stores the operation ID in the audit log', async () => {
        await service.uninstall(PLUGIN_ID, ACTOR_ID);

        expect(txAuditCreate).toHaveBeenCalledWith({
            data: {
                actorId: ACTOR_ID,
                action: 'plugin.uninstalled',
                targetType: 'Plugin',
                targetId: PLUGIN_ID,
                metadata: {
                    operationId: getOperationId(),
                    type: 'LANGUAGE',
                    version: VERSION,
                    previousStatus: 'INSTALLED',
                    languageCodes: ['es'],
                },
            },
        });
    });

    it('supports uninstalling a disabled plugin', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            status: 'DISABLED',
        });

        const result = await service.uninstall(PLUGIN_ID, ACTOR_ID);

        expect(result.removed).toBe(true);

        expect(getReservation().where.status).toBe('DISABLED');
    });

    it('rejects an invalid administrator identity', async () => {
        await expect(
            service.uninstall(PLUGIN_ID, 0),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(findUnique).not.toHaveBeenCalled();
        expect(updateMany).not.toHaveBeenCalled();
    });

    it('rejects a missing plugin', async () => {
        findUnique.mockResolvedValue(null);

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(updateMany).not.toHaveBeenCalled();
    });

    it('rejects a plugin in INSTALLING status', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            status: 'INSTALLING',
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(updateMany).not.toHaveBeenCalled();
    });

    it('rejects a plugin already being uninstalled', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            status: 'UNINSTALLING',
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an existing uninstall operation ID', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            uninstallOperationId:
                '33333333-3333-4333-8333-333333333333',
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(updateMany).not.toHaveBeenCalled();
    });

    it('rejects a concurrent reservation change', async () => {
        updateMany.mockResolvedValue({
            count: 0,
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(renameMock).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });

    it('rejects a storage path outside the plugin root', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            storagePath: '../outside/package',
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(updateMany).not.toHaveBeenCalled();
    });

    it('rejects a storage path with Windows separators', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            storagePath: `${PLUGIN_ID}-${INSTALL_UUID}\\package`,
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a storage directory belonging to another plugin', async () => {
        findUnique.mockResolvedValue({
            ...pluginRecord,
            storagePath:
                `another.plugin-${INSTALL_UUID}/package`,
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a symlinked storage directory', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (String(path) === SOURCE_DIRECTORY) {
                return symlinkStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            return directoryStats as Awaited<
                ReturnType<typeof lstat>
            >;
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(renameMock).not.toHaveBeenCalled();

        expect(updateMany).toHaveBeenLastCalledWith({
            where: {
                id: PLUGIN_ID,
                status: 'UNINSTALLING',
                version: VERSION,
                storagePath: STORAGE_PATH,
                uninstallOperationId: getOperationId(),
            },
            data: {
                status: 'INSTALLED',
                uninstallOperationId: null,
            },
        });
    });

    it('rolls back the reservation if moving the directory fails', async () => {
        renameMock.mockRejectedValueOnce(
            new Error('Move failed'),
        );

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toThrow('Move failed');

        expect(renameMock).toHaveBeenCalledTimes(1);

        expect(updateMany).toHaveBeenLastCalledWith({
            where: {
                id: PLUGIN_ID,
                status: 'UNINSTALLING',
                version: VERSION,
                storagePath: STORAGE_PATH,
                uninstallOperationId: getOperationId(),
            },
            data: {
                status: 'INSTALLED',
                uninstallOperationId: null,
            },
        });
    });

    it('restores the directory and clears the operation ID after transaction failure', async () => {
        txLanguageFindMany.mockRejectedValueOnce(
            new Error('Database failure'),
        );

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toThrow('Database failure');

        expect(renameMock).toHaveBeenNthCalledWith(
            1,
            SOURCE_DIRECTORY,
            getQuarantineDirectory(),
        );

        expect(renameMock).toHaveBeenNthCalledWith(
            2,
            getQuarantineDirectory(),
            SOURCE_DIRECTORY,
        );

        expect(updateMany).toHaveBeenLastCalledWith({
            where: {
                id: PLUGIN_ID,
                status: 'UNINSTALLING',
                version: VERSION,
                storagePath: STORAGE_PATH,
                uninstallOperationId: getOperationId(),
            },
            data: {
                status: 'INSTALLED',
                uninstallOperationId: null,
            },
        });
    });

    it('rejects uninstalling a built-in language', async () => {
        txLanguageFindMany.mockResolvedValue([
            {
                code: 'en',
                isBuiltIn: true,
                isFallback: false,
            },
        ]);

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(txLanguageDeleteMany).not.toHaveBeenCalled();
        expect(txPluginDeleteMany).not.toHaveBeenCalled();
    });

    it('rejects uninstalling a fallback language', async () => {
        txLanguageFindMany.mockResolvedValue([
            {
                code: 'es',
                isBuiltIn: false,
                isFallback: true,
            },
        ]);

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(txLanguageDeleteMany).not.toHaveBeenCalled();
    });

    it('rejects a mismatched operation ID inside the transaction', async () => {
        txFindUnique.mockResolvedValue({
            status: 'UNINSTALLING',
            version: VERSION,
            storagePath: STORAGE_PATH,
            uninstallOperationId:
                '44444444-4444-4444-8444-444444444444',
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(txPluginDeleteMany).not.toHaveBeenCalled();
    });

    it('rejects a failed conditional deletion', async () => {
        txPluginDeleteMany.mockResolvedValue({
            count: 0,
        });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(txAuditCreate).not.toHaveBeenCalled();
    });

    it('reports pending cleanup when filesystem deletion fails', async () => {
        rmMock.mockRejectedValueOnce(
            new Error('Directory locked'),
        );

        const result = await service.uninstall(
            PLUGIN_ID,
            ACTOR_ID,
        );

        expect(result).toEqual({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: true,
        });

        expect(txAuditCreate).toHaveBeenCalledTimes(1);
    });

    it('reports pending cleanup when quarantine validation fails', async () => {
        lstatMock.mockImplementation(async (path) => {
            if (
                String(path).startsWith(
                    `${QUARANTINE_ROOT}`,
                ) &&
                String(path) !== QUARANTINE_ROOT
            ) {
                return symlinkStats as Awaited<
                    ReturnType<typeof lstat>
                >;
            }

            return directoryStats as Awaited<
                ReturnType<typeof lstat>
            >;
        });

        const result = await service.uninstall(
            PLUGIN_ID,
            ACTOR_ID,
        );

        expect(result).toEqual({
            id: PLUGIN_ID,
            removed: true,
            cleanupPending: true,
        });

        expect(rmMock).not.toHaveBeenCalled();
    });

    it('reports incomplete rollback if restoring the directory fails', async () => {
        txLanguageFindMany.mockRejectedValueOnce(
            new Error('Database failure'),
        );

        renameMock
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(
                new Error('Restore failed'),
            );

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(
            InternalServerErrorException,
        );

        expect(updateMany).toHaveBeenCalledTimes(1);
    });

    it('reports incomplete rollback if restoring database status fails', async () => {
        txLanguageFindMany.mockRejectedValueOnce(
            new Error('Database failure'),
        );

        updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 });

        await expect(
            service.uninstall(PLUGIN_ID, ACTOR_ID),
        ).rejects.toBeInstanceOf(
            InternalServerErrorException,
        );

        expect(renameMock).toHaveBeenCalledTimes(2);
    });
});