import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { JobDispatcherService } from '../dispatcher/job-dispatcher.service';

describe('JobDispatcherService', () => {
    const findMany = jest.fn();
    const findUnique = jest.fn();
    const updateMany = jest.fn();
    const enqueueJob = jest.fn();
    const getJobState = jest.fn();
    const prisma = { job: { findMany, findUnique, updateMany } } as unknown as PrismaService;
    const queue = { enqueueJob, getJobState } as unknown as QueueService;
    let service: JobDispatcherService;

    beforeEach(() => {
        jest.resetAllMocks();
        service = new JobDispatcherService(prisma, queue);
    });

    it('fetches pending jobs in a bounded, deterministic batch', async () => {
        findMany.mockResolvedValue([]);
        await service.findPendingJobs(500);
        expect(findMany).toHaveBeenCalledWith({
            where: { status: 'PENDING' },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 100,
        });
    });

    it('claims only a pending job atomically', async () => {
        updateMany.mockResolvedValue({ count: 1 });
        await expect(service.claimJob('job-1')).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'job-1', status: 'PENDING' },
            data: { status: 'DISPATCHING', dispatchClaimedAt: expect.any(Date) },
        });
    });

    it('does not enqueue an invalid or non-pending job', async () => {
        findUnique.mockResolvedValue({ id: 'job-1', status: 'QUEUED', serverId: 1 });
        await expect(service.dispatchJob('job-1')).resolves.toBe(false);
        expect(enqueueJob).not.toHaveBeenCalled();
    });

    it('does not enqueue a job without a server', async () => {
        findUnique.mockResolvedValue({ id: 'job-1', status: 'PENDING', serverId: null });
        await expect(service.dispatchJob('job-1')).resolves.toBe(false);
        expect(enqueueJob).not.toHaveBeenCalled();
    });

    it('enqueues only after successfully claiming the job', async () => {
        findUnique.mockResolvedValue({ id: 'job-1', status: 'PENDING', serverId: 3, type: 'RESTART' });
        updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
        enqueueJob.mockResolvedValue({ id: 'bull-1' });
        await expect(service.dispatchJob('job-1')).resolves.toBe(true);
        expect(enqueueJob).toHaveBeenCalledWith('job-1', 'RESTART', 3);
        expect(updateMany).toHaveBeenLastCalledWith({
            where: { id: 'job-1', status: 'DISPATCHING' },
            data: { status: 'QUEUED', queueJobId: 'bull-1' },
        });
    });

    it('does not enqueue when another dispatcher won the claim', async () => {
        findUnique.mockResolvedValue({ id: 'job-1', status: 'PENDING', serverId: 3, type: 'RESTART' });
        updateMany.mockResolvedValue({ count: 0 });
        await expect(service.dispatchJob('job-1')).resolves.toBe(false);
        expect(enqueueJob).not.toHaveBeenCalled();
    });

    it('keeps a dispatch claim when Redis enqueue throws', async () => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            findUnique.mockResolvedValue({ id: 'job-1', status: 'PENDING', serverId: 3, type: 'RESTART' });
            updateMany.mockResolvedValue({ count: 1 });
            enqueueJob.mockRejectedValue(new Error('connection lost'));
            await expect(service.dispatchJob('job-1')).resolves.toBe(false);
            expect(updateMany).toHaveBeenCalledTimes(1);
        } finally { log.mockRestore(); }
    });

    it('recovers a stale waiting claim without re-enqueueing', async () => {
        const claimedAt = new Date(Date.now() - 10 * 60 * 1000);
        findUnique.mockResolvedValue({ id: 'job-1', status: 'DISPATCHING', dispatchClaimedAt: claimedAt });
        getJobState.mockResolvedValue('waiting');
        updateMany.mockResolvedValue({ count: 1 });
        await expect(service.recoverWaitingJob('job-1')).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'job-1', status: 'DISPATCHING', dispatchClaimedAt: claimedAt },
            data: { status: 'QUEUED', queueJobId: 'job-1' },
        });
        expect(enqueueJob).not.toHaveBeenCalled();
    });

    it('does not recover a fresh claim', async () => {
        findUnique.mockResolvedValue({ id: 'job-1', status: 'DISPATCHING', dispatchClaimedAt: new Date() });
        await expect(service.recoverStaleJob('job-1')).resolves.toBe(false);
        expect(getJobState).not.toHaveBeenCalled();
    });

    it.each(['active', 'completed', 'failed', null])('does not blindly recover queue state %s', async (state) => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            findUnique.mockResolvedValue({ id: 'job-1', status: 'DISPATCHING', dispatchClaimedAt: new Date(Date.now() - 600000) });
            getJobState.mockResolvedValue(state);
            await expect(service.recoverStaleJob('job-1')).resolves.toBe(false);
            expect(updateMany).not.toHaveBeenCalled();
            expect(enqueueJob).not.toHaveBeenCalled();
        } finally { warn.mockRestore(); }
    });

    it('continues dispatching other jobs after an individual failure', async () => {
        findMany.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }]);
        const dispatch = jest.spyOn(service, 'dispatchJob')
            .mockRejectedValueOnce(new Error('failed'))
            .mockResolvedValueOnce(true);
        const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            await expect(service.dispatchPendingJobs()).resolves.toBe(1);
            expect(dispatch).toHaveBeenCalledTimes(2);
        } finally { log.mockRestore(); }
    });
});
