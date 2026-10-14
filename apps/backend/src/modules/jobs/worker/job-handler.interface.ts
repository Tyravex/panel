import { JobType } from '@prisma/client';

// Data required to execute a server operation.
export interface JobExecutionContext {
    jobId: string;
    serverId: number;
}

// Contract implemented by individual server operation handlers.
export interface JobHandler {
    readonly type: JobType;

    execute(context: JobExecutionContext): Promise<void>;
}