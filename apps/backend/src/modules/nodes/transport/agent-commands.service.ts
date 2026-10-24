import {
    AgentCommandStatus,
    JobType,
    Prisma,
    PrismaClient,
} from '@prisma/client';

export type AgentCommandDatabase = Pick<
    PrismaClient,
    'job' | 'agentCommand'
>;

export type PrepareInstallCommandInput = {
    jobId: string;
    nodeId: string;
    serviceId: string;
};

export type AgentCommandTransitionResult =
    | 'updated'
    | 'unchanged'
    | 'rejected';

export class AgentCommandsService {
    constructor(
        private readonly database: AgentCommandDatabase,
    ) { }

    /**
     * Creates the durable command identity for an INSTALL job.
     *
     * This method never sends anything to the Agent.
     * Repeated calls return the existing command only if its
     * identity and target still match.
     */
    async prepareInstall(
        input: PrepareInstallCommandInput,
    ) {
        this.assertIdentifier(input.jobId, 'jobId');
        this.assertIdentifier(input.nodeId, 'nodeId');
        this.assertIdentifier(input.serviceId, 'serviceId');

        const job = await this.database.job.findUnique({
            where: {
                id: input.jobId,
            },
            select: {
                id: true,
                type: true,
                serviceId: true,
            },
        });

        if (!job) {
            throw new Error('INSTALL job not found');
        }

        if (job.type !== JobType.INSTALL) {
            throw new Error('Job is not an INSTALL job');
        }

        if (job.serviceId !== input.serviceId) {
            throw new Error('Job serviceId mismatch');
        }

        const jobCommandKey = `install:${job.id}`;

        const existing = await this.database.agentCommand.findUnique({
            where: {
                jobCommandKey,
            },
        });

        if (existing) {
            return this.verifyExisting(existing, input);
        }

        try {
            return await this.database.agentCommand.create({
                data: {
                    jobId: job.id,
                    jobCommandKey,
                    nodeId: input.nodeId,
                    serviceId: input.serviceId,
                    operation: 'service.install',
                    status: AgentCommandStatus.PREPARED,
                },
            });
        } catch (error) {
            // Concurrent requests may race on jobCommandKey.
            // The unique database constraint is the final guard.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const concurrent =
                    await this.database.agentCommand.findUnique({
                        where: {
                            jobCommandKey,
                        },
                    });

                if (concurrent) {
                    return this.verifyExisting(
                        concurrent,
                        input,
                    );
                }
            }

            throw error;
        }
    }

    /**
     * Claims the only permitted transport attempt.
     *
     * IMPORTANT: Call before socket.send().
     * Once claimed, the command must not be automatically
     * sent again after a restart or transport failure.
     */
    async claimSend(
        commandId: string,
        sessionId: string,
    ): Promise<boolean> {
        this.assertIdentifier(commandId, 'commandId');
        this.assertIdentifier(sessionId, 'sessionId');

        const result = await this.database.agentCommand.updateMany({
            where: {
                id: commandId,
                status: AgentCommandStatus.PREPARED,
                sessionId: null,
            },
            data: {
                status: AgentCommandStatus.SENT,
                sessionId,
                sentAt: new Date(),
            },
        });

        return result.count === 1;
    }

    /**
     * Records an Agent acknowledgement.
     *
     * Duplicate acknowledgements cannot overwrite the state.
     */
    async markAccepted(
        commandId: string,
        sessionId: string,
    ): Promise<boolean> {
        this.assertIdentifier(commandId, 'commandId');
        this.assertIdentifier(sessionId, 'sessionId');

        const result = await this.database.agentCommand.updateMany({
            where: {
                id: commandId,
                sessionId,
                status: AgentCommandStatus.SENT,
            },
            data: {
                status: AgentCommandStatus.ACCEPTED,
                acceptedAt: new Date(),
            },
        });

        return result.count === 1;
    }

    /**
     * Records the definitive result of an Agent command.
     *
     * A final result may arrive without command.accepted.
     * UNKNOWN is intentionally excluded: late responses
     * require a separate reconciliation policy.
     */
    async markResult(
        commandId: string,
        sessionId: string,
        success: boolean,
        errorCode?: string,
    ): Promise<boolean> {
        this.assertIdentifier(commandId, 'commandId');
        this.assertIdentifier(sessionId, 'sessionId');

        if (
            errorCode !== undefined &&
            (
                errorCode.length === 0 ||
                errorCode.length > 128 ||
                !/^[A-Za-z0-9_.-]+$/.test(errorCode)
            )
        ) {
            throw new Error('Invalid errorCode');
        }

        const status = success
            ? AgentCommandStatus.COMPLETED
            : AgentCommandStatus.FAILED;

        const result = await this.database.agentCommand.updateMany({
            where: {
                id: commandId,
                sessionId,
                status: {
                    in: [
                        AgentCommandStatus.SENT,
                        AgentCommandStatus.ACCEPTED,
                    ],
                },
            },
            data: {
                status,
                finishedAt: new Date(),
                errorCode: success
                    ? null
                    : (errorCode ?? 'AGENT_COMMAND_FAILED'),
            },
        });

        return result.count === 1;
    }

    /**
     * Marks an uncertain outcome.
     *
     * UNKNOWN does not mean FAILED and does not authorize
     * another execution attempt.
     */
    async markUnknown(
        commandId: string,
    ): Promise<boolean> {
        this.assertIdentifier(commandId, 'commandId');

        const result = await this.database.agentCommand.updateMany({
            where: {
                id: commandId,
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

        return result.count === 1;
    }

    async findById(commandId: string) {
        this.assertIdentifier(commandId, 'commandId');

        return this.database.agentCommand.findUnique({
            where: {
                id: commandId,
            },
        });
    }

    private verifyExisting<
        T extends {
            jobId: string;
            nodeId: string;
            serviceId: string;
            operation: string;
        },
    >(
        existing: T,
        input: PrepareInstallCommandInput,
    ): T {
        if (
            existing.jobId !== input.jobId ||
            existing.nodeId !== input.nodeId ||
            existing.serviceId !== input.serviceId ||
            existing.operation !== 'service.install'
        ) {
            throw new Error(
                'Existing INSTALL command identity mismatch',
            );
        }

        return existing;
    }

    private assertIdentifier(
        value: string,
        field: string,
    ): void {
        if (
            typeof value !== 'string' ||
            value.length === 0 ||
            value.length > 128 ||
            !/^[A-Za-z0-9_-]+$/.test(value)
        ) {
            throw new Error(`Invalid ${field}`);
        }
    }
}
