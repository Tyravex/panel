import { Injectable } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { JobHandler } from './job-handler.interface';

@Injectable()
export class JobHandlerRegistry {
    private readonly handlers = new Map<JobType, JobHandler>();

    // Register an operation handler and reject duplicate registrations.
    register(handler: JobHandler): void {
        if (this.handlers.has(handler.type)) {
            throw new Error(
                `Handler already registered for operation ${handler.type}`,
            );
        }

        this.handlers.set(handler.type, handler);
    }

    // Resolve a handler for the requested server operation.
    get(type: JobType): JobHandler | null {
        return this.handlers.get(type) ?? null;
    }

    // Check whether every supported operation has a handler.
    hasAllHandlers(): boolean {
        return Object.values(JobType).every((type) =>
            this.handlers.has(type),
        );
    }
}