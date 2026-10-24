import { AgentCommandStatus } from '@prisma/client';

import { AgentCommandsService } from '../agent-commands.service';
import {
    AgentCommandRecoveryDatabase,
    AgentCommandRecoveryService,
} from '../agent-command-recovery.service';

describe('AgentCommandRecoveryService', () => {
    let findMany: jest.Mock;
    let markUnknown: jest.Mock;

    let recovery: AgentCommandRecoveryService;

    beforeEach(() => {
        findMany = jest.fn();
        markUnknown = jest.fn();

        const database = {
            agentCommand: {
                findMany,
            },
        } as unknown as AgentCommandRecoveryDatabase;

        const commandsService = {
            markUnknown,
        } as unknown as AgentCommandsService;

        recovery = new AgentCommandRecoveryService(
            database,
            commandsService,
        );
    });

    it('returns zero counts when no commands require recovery', async () => {
        findMany.mockResolvedValue([]);

        await expect(recovery.recoverBatch()).resolves.toEqual({
            scanned: 0,
            markedUnknown: 0,
            skipped: 0,
            failed: 0,
        });

        expect(markUnknown).not.toHaveBeenCalled();
    });

    it('selects only SENT and ACCEPTED commands', async () => {
        findMany.mockResolvedValue([]);

        await recovery.recoverBatch();

        expect(findMany).toHaveBeenCalledWith({
            where: {
                status: {
                    in: [
                        AgentCommandStatus.SENT,
                        AgentCommandStatus.ACCEPTED,
                    ],
                },
            },
            select: {
                id: true,
            },
            take: 100,
            orderBy: {
                preparedAt: 'asc',
            },
        });
    });

    it('marks SENT commands as UNKNOWN', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
        ]);

        markUnknown.mockResolvedValue(true);

        await expect(recovery.recoverBatch()).resolves.toEqual({
            scanned: 1,
            markedUnknown: 1,
            skipped: 0,
            failed: 0,
        });

        expect(markUnknown).toHaveBeenCalledWith('command-1');
    });

    it('processes multiple uncertain commands', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
            { id: 'command-2' },
            { id: 'command-3' },
        ]);

        markUnknown.mockResolvedValue(true);

        await expect(recovery.recoverBatch()).resolves.toEqual({
            scanned: 3,
            markedUnknown: 3,
            skipped: 0,
            failed: 0,
        });

        expect(markUnknown).toHaveBeenCalledTimes(3);
    });

    it('counts conditional updates that did not change a record', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
        ]);

        markUnknown.mockResolvedValue(false);

        await expect(recovery.recoverBatch()).resolves.toEqual({
            scanned: 1,
            markedUnknown: 0,
            skipped: 1,
            failed: 0,
        });
    });

    it('does not abort the batch after one database failure', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
            { id: 'command-2' },
        ]);

        markUnknown
            .mockRejectedValueOnce(new Error('Database unavailable'))
            .mockResolvedValueOnce(true);

        await expect(recovery.recoverBatch()).resolves.toEqual({
            scanned: 2,
            markedUnknown: 1,
            skipped: 0,
            failed: 1,
        });

        expect(markUnknown).toHaveBeenCalledTimes(2);
    });

    it('propagates a failure to query the database', async () => {
        findMany.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(recovery.recoverBatch()).rejects.toThrow(
            'Database unavailable',
        );

        expect(markUnknown).not.toHaveBeenCalled();
    });

    it('finishes recoverAll when the database has no pending commands', async () => {
        findMany.mockResolvedValue([]);

        await expect(recovery.recoverAll()).resolves.toEqual({
            scanned: 0,
            markedUnknown: 0,
            skipped: 0,
            failed: 0,
        });

        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('recovers multiple batches', async () => {
        findMany
            .mockResolvedValueOnce([
                { id: 'command-1' },
                { id: 'command-2' },
            ])
            .mockResolvedValueOnce([
                { id: 'command-3' },
            ])
            .mockResolvedValueOnce([]);

        markUnknown.mockResolvedValue(true);

        await expect(recovery.recoverAll()).resolves.toEqual({
            scanned: 3,
            markedUnknown: 3,
            skipped: 0,
            failed: 0,
        });

        expect(findMany).toHaveBeenCalledTimes(3);
        expect(markUnknown).toHaveBeenCalledTimes(3);
    });

    it('rejects recoverAll after a failed update', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
        ]);

        markUnknown.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(recovery.recoverAll()).rejects.toThrow(
            'Agent command recovery failed: 1 command update(s) failed',
        );

        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('rejects recoverAll if a batch makes no progress', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
        ]);

        markUnknown.mockResolvedValue(false);

        await expect(recovery.recoverAll()).rejects.toThrow(
            'Agent command recovery made no progress',
        );

        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('never invokes a command dispatch method', async () => {
        findMany.mockResolvedValue([
            { id: 'command-1' },
        ]);

        markUnknown.mockResolvedValue(true);

        const dispatch = jest.fn();

        await recovery.recoverBatch();

        expect(dispatch).not.toHaveBeenCalled();
        expect(markUnknown).toHaveBeenCalledWith('command-1');
    });
});
