import {
    AgentCommandStatus,
    JobType,
} from '@prisma/client';

import {
    AgentCommandsService,
    type AgentCommandDatabase,
} from '../agent-commands.service';

describe('AgentCommandsService', () => {
    let service: AgentCommandsService;

    const job = {
        id: 'job-test-1',
        type: JobType.INSTALL,
        serviceId: 'service-test-1',
    };

    const input = {
        jobId: 'job-test-1',
        nodeId: 'node-test-1',
        serviceId: 'service-test-1',
    };

    const command = {
        id: 'command-test-1',
        jobId: input.jobId,
        jobCommandKey: `install:${input.jobId}`,
        nodeId: input.nodeId,
        serviceId: input.serviceId,
        operation: 'service.install',
        status: AgentCommandStatus.PREPARED,
    };

    const database = {
        job: {
            findUnique: jest.fn(),
        },
        agentCommand: {
            findUnique: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.resetAllMocks();

        database.job.findUnique.mockResolvedValue(job);
        database.agentCommand.findUnique.mockResolvedValue(null);
        database.agentCommand.create.mockResolvedValue(command);
        database.agentCommand.updateMany.mockResolvedValue({
            count: 1,
        });

        service = new AgentCommandsService(
            database as unknown as AgentCommandDatabase,
        );
    });

    it('prepares a durable INSTALL command', async () => {
        const result = await service.prepareInstall(input);

        expect(result).toEqual(command);

        expect(database.agentCommand.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                jobId: input.jobId,
                jobCommandKey: `install:${input.jobId}`,
                nodeId: input.nodeId,
                serviceId: input.serviceId,
                operation: 'service.install',
                status: AgentCommandStatus.PREPARED,
            }),
        });
    });

    it('returns an existing matching command', async () => {
        database.agentCommand.findUnique.mockResolvedValue(command);

        const result = await service.prepareInstall(input);

        expect(result).toEqual(command);
        expect(database.agentCommand.create).not.toHaveBeenCalled();
    });

    it('rejects a mismatched existing command', async () => {
        database.agentCommand.findUnique.mockResolvedValue({
            ...command,
            nodeId: 'different-node',
        });

        await expect(
            service.prepareInstall(input),
        ).rejects.toThrow(
            'Existing INSTALL command identity mismatch',
        );
    });

    it('rejects a job with another serviceId', async () => {
        database.job.findUnique.mockResolvedValue({
            ...job,
            serviceId: 'different-service',
        });

        await expect(
            service.prepareInstall(input),
        ).rejects.toThrow('Job serviceId mismatch');
    });

    it('rejects a non-INSTALL job', async () => {
        database.job.findUnique.mockResolvedValue({
            ...job,
            type: JobType.BACKUP,
        });

        await expect(
            service.prepareInstall(input),
        ).rejects.toThrow('Job is not an INSTALL job');
    });

    it('claims sending only from PREPARED', async () => {
        expect(
            await service.claimSend(
                command.id,
                'session-test-1',
            ),
        ).toBe(true);

        expect(database.agentCommand.updateMany).toHaveBeenCalledWith({
            where: {
                id: command.id,
                status: AgentCommandStatus.PREPARED,
                sessionId: null,
            },
            data: {
                status: AgentCommandStatus.SENT,
                sessionId: 'session-test-1',
                sentAt: expect.any(Date),
            },
        });
    });

    it('rejects a second send claim', async () => {
        database.agentCommand.updateMany.mockResolvedValue({
            count: 0,
        });

        expect(
            await service.claimSend(
                command.id,
                'session-test-2',
            ),
        ).toBe(false);
    });

    it('accepts acknowledgement only from SENT', async () => {
        expect(
            await service.markAccepted(
                command.id,
                'session-test-1',
            ),
        ).toBe(true);

        expect(database.agentCommand.updateMany).toHaveBeenCalledWith({
            where: {
                id: command.id,
                sessionId: 'session-test-1',
                status: AgentCommandStatus.SENT,
            },
            data: {
                status: AgentCommandStatus.ACCEPTED,
                acceptedAt: expect.any(Date),
            },
        });
    });

    it('records a successful final result', async () => {
        expect(
            await service.markResult(
                command.id,
                'session-test-1',
                true,
            ),
        ).toBe(true);

        expect(database.agentCommand.updateMany).toHaveBeenCalledWith({
            where: {
                id: command.id,
                sessionId: 'session-test-1',
                status: {
                    in: [
                        AgentCommandStatus.SENT,
                        AgentCommandStatus.ACCEPTED,
                    ],
                },
            },
            data: {
                status: AgentCommandStatus.COMPLETED,
                finishedAt: expect.any(Date),
                errorCode: null,
            },
        });
    });

    it('records a failed final result', async () => {
        expect(
            await service.markResult(
                command.id,
                'session-test-1',
                false,
                'INSTALL_FAILED',
            ),
        ).toBe(true);

        expect(database.agentCommand.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({
                id: command.id,
                sessionId: 'session-test-1',
            }),
            data: expect.objectContaining({
                status: AgentCommandStatus.FAILED,
                errorCode: 'INSTALL_FAILED',
            }),
        });
    });

    it('marks SENT or ACCEPTED as UNKNOWN', async () => {
        expect(
            await service.markUnknown(command.id),
        ).toBe(true);

        expect(database.agentCommand.updateMany).toHaveBeenCalledWith({
            where: {
                id: command.id,
                status: {
                    in: [
                        AgentCommandStatus.SENT,
                        AgentCommandStatus.ACCEPTED,
                    ],
                },
            },
            data: {
                status: AgentCommandStatus.UNKNOWN,
            },
        });
    });

    it('does not change a terminal command', async () => {
        database.agentCommand.updateMany.mockResolvedValue({
            count: 0,
        });

        expect(
            await service.markUnknown(command.id),
        ).toBe(false);

        expect(
            await service.markResult(
                command.id,
                'session-test-1',
                true,
            ),
        ).toBe(false);
    });
});
