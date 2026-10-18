import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { JobExecutionService } from '../worker/job-execution.service';
import { JobHandlerRegistry } from '../worker/job-handler.registry';
import { JobWorkerService } from '../worker/job-worker.service';

describe('JobWorkerService', () => {
    const get = jest.fn();
    const findUnique = jest.fn();
    const startJob = jest.fn();
    const completeJob = jest.fn();
    const failJob = jest.fn();
    const hasAllHandlers = jest.fn();
    const getHandler = jest.fn();
    const execute = jest.fn();

    const config = { get } as unknown as ConfigService;
    const prisma = { job: { findUnique } } as unknown as PrismaService;
    const execution = { startJob, completeJob, failJob } as unknown as JobExecutionService;
    const registry = { hasAllHandlers, get: getHandler } as unknown as JobHandlerRegistry;
    let service: JobWorkerService;

    const job = (data: unknown = { jobId: 'job-1', serverId: 5 }, id = 'job-1', name = 'RESTART') =>
        ({ data, id, name }) as Job<{ jobId: string; serverId: number }>;

    beforeEach(() => {
        jest.resetAllMocks();
        service = new JobWorkerService(config, prisma, execution, registry);
        get.mockReturnValue(undefined);
        findUnique.mockResolvedValue({ id: 'job-1', serverId: 5, type: 'RESTART' });
        getHandler.mockReturnValue({ execute });
        startJob.mockResolvedValue(true);
        completeJob.mockResolvedValue(true);
        failJob.mockResolvedValue(true);
        execute.mockResolvedValue(undefined);
    });

    // The worker is intentionally disabled in unit tests; no Redis connection is created.
    const process = (payload: Job<{ jobId: string; serverId: number }>) =>
        (service as unknown as { processJob(job: Job<{ jobId: string; serverId: number }>): Promise<void> }).processJob(payload);

    it('does not start a BullMQ worker when disabled', () => {
        service.onModuleInit();
        expect(hasAllHandlers).not.toHaveBeenCalled();
    });

    it('rejects enabling the worker without all handlers', () => {
        get.mockImplementation((key: string) => key === 'JOB_WORKER_ENABLED' ? 'true' : undefined);
        hasAllHandlers.mockReturnValue(false);
        expect(() => service.onModuleInit()).toThrow('server operation handlers are not implemented');
    });

    it('rejects enabling the worker without Redis configuration', () => {
        get.mockImplementation((key: string) => key === 'JOB_WORKER_ENABLED' ? 'true' : undefined);
        hasAllHandlers.mockReturnValue(true);
        expect(() => service.onModuleInit()).toThrow('REDIS_URL is required');
    });

    it.each([
        [{ jobId: '', serverId: 5 }, 'job-1'],
        [{ jobId: 'job-1', serverId: 0 }, 'job-1'],
        [{ jobId: 'job-1', serverId: 2.5 }, 'job-1'],
        [{ jobId: 'job-1', serverId: 5 }, 'different-id'],
    ])('rejects an invalid or mismatched payload', async (data, id) => {
        await expect(process(job(data, id))).rejects.toThrow('Invalid or mismatched');
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects a payload that does not match PostgreSQL', async () => {
        findUnique.mockResolvedValue({ id: 'job-1', serverId: 7, type: 'RESTART' });
        await expect(process(job())).rejects.toThrow('does not match PostgreSQL');
        expect(startJob).not.toHaveBeenCalled();
    });

    it('rejects an operation without a registered handler', async () => {
        getHandler.mockReturnValue(null);
        await expect(process(job())).rejects.toThrow('No handler registered');
        expect(startJob).not.toHaveBeenCalled();
    });

    it('skips redelivered jobs when the execution claim fails', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            startJob.mockResolvedValue(false);
            await expect(process(job())).resolves.toBeUndefined();
            expect(execute).not.toHaveBeenCalled();
            expect(completeJob).not.toHaveBeenCalled();
        } finally { warn.mockRestore(); }
    });

    it('executes a claimed job and persists completion', async () => {
        await process(job());
        expect(startJob).toHaveBeenCalledWith('job-1', 5);
        expect(execute).toHaveBeenCalledWith({ jobId: 'job-1', serverId: 5 });
        expect(completeJob).toHaveBeenCalledWith('job-1');
        expect(failJob).not.toHaveBeenCalled();
    });

    it('persists a handler failure and propagates the error', async () => {
        const error = new Error('operation failed');
        execute.mockRejectedValue(error);
        await expect(process(job())).rejects.toBe(error);
        expect(failJob).toHaveBeenCalledWith('job-1', error);
        expect(completeJob).not.toHaveBeenCalled();
    });

    it('does not mark a successful operation as failed when completion persistence fails', async () => {
        completeJob.mockResolvedValue(false);
        await expect(process(job())).rejects.toThrow('completion could not be persisted');
        expect(execute).toHaveBeenCalledTimes(1);
        expect(failJob).not.toHaveBeenCalled();
    });

    it('closes safely when no worker was started', async () => {
        await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
});
