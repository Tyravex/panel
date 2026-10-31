import { PluginCleanupClaimService } from '../plugin-cleanup-claim.service';
import { PluginRecoveryCoordinatorService } from '../plugin-recovery-coordinator.service';
import { PluginRecoveryFilesystemLockService } from '../plugin-recovery-filesystem-lock.service';
import { PluginUninstallationCleanupService } from '../plugin-uninstallation-cleanup.service';

describe('PluginRecoveryCoordinatorService', () => {
    const claimPending = jest.fn();
    const cleanupCompleted = jest.fn();
    const withLock = jest.fn();

    const service = new PluginRecoveryCoordinatorService(
        {
            withLock,
        } as unknown as PluginRecoveryFilesystemLockService,
        {
            claimPending,
        } as unknown as PluginCleanupClaimService,
        {
            cleanupCompleted,
        } as unknown as PluginUninstallationCleanupService,
    );

    beforeEach(() => {
        jest.resetAllMocks();

        claimPending.mockResolvedValue({
            checked: 1,
            claimed: 1,
            skipped: 0,
            failed: 0,
        });

        cleanupCompleted.mockResolvedValue({
            checked: 1,
            removed: 1,
            skipped: 0,
            failed: 0,
        });

        withLock.mockImplementation(
            async (operation: () => Promise<unknown>) => ({
                acquired: true,
                result: await operation(),
            }),
        );
    });

    it('runs claim before cleanup', async () => {
        const order: string[] = [];

        claimPending.mockImplementation(async () => {
            order.push('claim');
            return {
                checked: 1,
                claimed: 1,
                skipped: 0,
                failed: 0,
            };
        });

        cleanupCompleted.mockImplementation(async () => {
            order.push('cleanup');
            return {
                checked: 1,
                removed: 1,
                skipped: 0,
                failed: 0,
            };
        });

        const report = await service.runOnce();

        expect(order).toEqual(['claim', 'cleanup']);
        expect(report.acquired).toBe(true);
        expect(report.claim?.claimed).toBe(1);
        expect(report.cleanup?.removed).toBe(1);
    });

    it('does not execute when the lock is unavailable', async () => {
        withLock.mockResolvedValue({
            acquired: false,
        });

        const report = await service.runOnce();

        expect(report).toEqual({
            acquired: false,
        });

        expect(claimPending).not.toHaveBeenCalled();
        expect(cleanupCompleted).not.toHaveBeenCalled();
    });

    it('does not run cleanup when claim throws', async () => {
        claimPending.mockRejectedValue(
            new Error('Claim failed'),
        );

        await expect(
            service.runOnce(),
        ).rejects.toThrow('Claim failed');

        expect(cleanupCompleted).not.toHaveBeenCalled();
    });

    it('propagates cleanup failures', async () => {
        cleanupCompleted.mockRejectedValue(
            new Error('Cleanup failed'),
        );

        await expect(
            service.runOnce(),
        ).rejects.toThrow('Cleanup failed');
    });

    it('rejects an acquired lock without a result', async () => {
        withLock.mockResolvedValue({
            acquired: true,
        });

        await expect(
            service.runOnce(),
        ).rejects.toThrow(
            'Plugin recovery completed without a result.',
        );
    });
});