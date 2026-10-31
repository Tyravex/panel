import {
    lstat,
    mkdir,
    rmdir,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { PluginRecoveryFilesystemLockService } from '../plugin-recovery-filesystem-lock.service';
import { getPluginStorageRoot } from '../plugin-storage.config';

jest.mock('node:fs/promises', () => ({
    lstat: jest.fn(),
    mkdir: jest.fn(),
    rmdir: jest.fn(),
}));

jest.mock('../plugin-storage.config', () => ({
    getPluginStorageRoot: jest.fn(),
}));

const ROOT = resolve('test', 'plugin-recovery-lock');
const LOCK_DIRECTORY = join(ROOT, '.recovery.lock');

const directoryStats = {
    isDirectory: () => true,
    isSymbolicLink: () => false,
};

const existsError = () =>
    Object.assign(new Error('Already exists'), {
        code: 'EEXIST',
    });

describe('PluginRecoveryFilesystemLockService', () => {
    const service =
        new PluginRecoveryFilesystemLockService();

    const lstatMock = jest.mocked(lstat);
    const mkdirMock = jest.mocked(mkdir);
    const rmdirMock = jest.mocked(rmdir);

    beforeEach(() => {
        jest.resetAllMocks();

        jest.mocked(getPluginStorageRoot)
            .mockReturnValue(ROOT);

        lstatMock.mockResolvedValue(
            directoryStats as never,
        );

        mkdirMock.mockResolvedValue(undefined);
        rmdirMock.mockResolvedValue(undefined);
    });

    it('runs an operation under an exclusive lock', async () => {
        const operation = jest.fn().mockResolvedValue(42);

        const result = await service.withLock(operation);

        expect(result).toEqual({
            acquired: true,
            result: 42,
        });

        expect(mkdirMock).toHaveBeenCalledWith(
            LOCK_DIRECTORY,
            {
                mode: 0o700,
                recursive: false,
            },
        );

        expect(operation).toHaveBeenCalledTimes(1);
        expect(rmdirMock).toHaveBeenCalledWith(
            LOCK_DIRECTORY,
        );
    });

    it('skips when another process holds the lock', async () => {
        mkdirMock.mockRejectedValue(existsError());

        const operation = jest.fn();

        const result = await service.withLock(operation);

        expect(result).toEqual({
            acquired: false,
        });

        expect(operation).not.toHaveBeenCalled();
        expect(rmdirMock).not.toHaveBeenCalled();
    });

    it('releases the lock after an operation error', async () => {
        const error = new Error('Operation failed');

        await expect(
            service.withLock(async () => {
                throw error;
            }),
        ).rejects.toThrow('Operation failed');

        expect(rmdirMock).toHaveBeenCalledWith(
            LOCK_DIRECTORY,
        );
    });

    it('does not execute when storage is missing', async () => {
        lstatMock.mockRejectedValue(
            Object.assign(new Error('Not found'), {
                code: 'ENOENT',
            }),
        );

        const operation = jest.fn();

        await expect(
            service.withLock(operation),
        ).rejects.toThrow(
            'Plugin storage root is not a regular directory.',
        );

        expect(operation).not.toHaveBeenCalled();
        expect(mkdirMock).not.toHaveBeenCalled();
    });

    it('does not execute when storage is a symlink', async () => {
        lstatMock.mockResolvedValue({
            isDirectory: () => true,
            isSymbolicLink: () => true,
        } as never);

        const operation = jest.fn();

        await expect(
            service.withLock(operation),
        ).rejects.toThrow(
            'Plugin storage root is not a regular directory.',
        );

        expect(operation).not.toHaveBeenCalled();
    });

    it('does not silently ignore lock release errors', async () => {
        rmdirMock.mockRejectedValue(
            new Error('Release failed'),
        );

        await expect(
            service.withLock(async () => 42),
        ).rejects.toThrow('Release failed');
    });

    it('prevents a second concurrent operation', async () => {
        let releaseFirst!: () => void;

        const firstGate = new Promise<void>((resolveGate) => {
            releaseFirst = resolveGate;
        });

        let locked = false;

        mkdirMock.mockImplementation(async () => {
            if (locked) {
                throw existsError();
            }

            locked = true;
            return undefined;
        });

        rmdirMock.mockImplementation(async () => {
            locked = false;
        });

        const firstOperation = jest.fn(async () => {
            await firstGate;
            return 'first';
        });

        const secondOperation = jest.fn(
            async () => 'second',
        );

        const first = service.withLock(firstOperation);

        // Allow the first call to acquire the mocked lock.
        await Promise.resolve();
        await Promise.resolve();

        const second = await service.withLock(
            secondOperation,
        );

        expect(second).toEqual({
            acquired: false,
        });

        expect(secondOperation).not.toHaveBeenCalled();

        releaseFirst();

        await expect(first).resolves.toEqual({
            acquired: true,
            result: 'first',
        });

        expect(firstOperation).toHaveBeenCalledTimes(1);
    });
});