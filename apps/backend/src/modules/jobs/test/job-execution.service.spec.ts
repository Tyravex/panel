import { PrismaService } from '@/prisma/prisma.service';
import { JobExecutionService } from '../worker/job-execution.service';

describe('JobExecutionService', () => {
    const updateMany = jest.fn();
    const prisma = { job: { updateMany } } as unknown as PrismaService;
    const service = new JobExecutionService(prisma);

    beforeEach(() => jest.resetAllMocks());

    it('atomically starts a queued or dispatching job for the correct server', async () => {
        updateMany.mockResolvedValue({ count: 1 });
        await expect(service.startJob('job-1', 42)).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'job-1', serverId: 42, status: { in: ['QUEUED', 'DISPATCHING'] } },
            data: { status: 'RUNNING', startedAt: expect.any(Date), progress: 0 },
        });
    });

    it('rejects an already claimed job', async () => {
        updateMany.mockResolvedValue({ count: 0 });
        await expect(service.startJob('job-1', 42)).resolves.toBe(false);
    });

    it.each([NaN, Infinity, -Infinity])('rejects non-finite progress %s', async (value) => {
        await expect(service.updateProgress('job-1', value)).resolves.toBe(false);
        expect(updateMany).not.toHaveBeenCalled();
    });

    it.each([[23.9, 23], [-10, 0], [140, 100]])('normalizes progress %s to %s', async (input, expected) => {
        updateMany.mockResolvedValue({ count: 1 });
        await expect(service.updateProgress('job-1', input)).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'job-1', status: 'RUNNING' },
            data: { progress: expected },
        });
    });

    it('does not update progress after a terminal transition', async () => {
        updateMany.mockResolvedValue({ count: 0 });
        await expect(service.updateProgress('job-1', 50)).resolves.toBe(false);
    });

    it('completes only a running job', async () => {
        updateMany.mockResolvedValue({ count: 1 });
        await expect(service.completeJob('job-1')).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'job-1', status: 'RUNNING' },
            data: { status: 'COMPLETED', progress: 100, finishedAt: expect.any(Date), errorMessage: null },
        });
    });

    it('persists a failure only for a running job', async () => {
        updateMany.mockResolvedValue({ count: 1 });
        await expect(service.failJob('job-1', new Error('handler failed'))).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'job-1', status: 'RUNNING' },
            data: { status: 'FAILED', finishedAt: expect.any(Date), errorMessage: 'handler failed' },
        });
    });

    it('limits persisted error messages to 10000 characters', async () => {
        updateMany.mockResolvedValue({ count: 1 });
        await service.failJob('job-1', 'x'.repeat(12000));
        expect(updateMany.mock.calls[0][0].data.errorMessage).toHaveLength(10000);
    });
});
