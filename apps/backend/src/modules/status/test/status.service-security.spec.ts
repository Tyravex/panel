import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { StatusService } from '../status.service';

describe('StatusService infrastructure failure boundaries', () => {
    const queryRaw = jest.fn();
    const getClient = jest.fn();
    const ping = jest.fn();
    const service = new StatusService(
        { $queryRaw: queryRaw } as unknown as PrismaService,
        { getClient, ping } as unknown as RedisService,
    );

    beforeEach(() => {
        jest.resetAllMocks();
        queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        getClient.mockReturnValue(null);
    });

    it('reports healthy status when PostgreSQL works and Redis is disabled', async () => {
        const result = await service.getStatus();
        expect(result.status).toBe('ok');
        expect(result.database.status).toBe('ok');
        expect(result.cache.status).toBe('disabled');
        expect(ping).not.toHaveBeenCalled();
    });

    it('degrades safely when PostgreSQL is unavailable', async () => {
        queryRaw.mockRejectedValueOnce(new Error('private connection string'));
        const result = await service.getStatus();
        expect(result.status).toBe('degraded');
        expect(result.database.status).toBe('fail');
        expect(JSON.stringify(result)).not.toContain('private connection string');
    });

    it('reports healthy status when configured Redis responds', async () => {
        getClient.mockReturnValue({});
        ping.mockResolvedValue(true);
        const result = await service.getStatus();
        expect(result.status).toBe('ok');
        expect(result.cache.status).toBe('ok');
        expect(ping).toHaveBeenCalledTimes(1);
    });

    it('degrades when configured Redis does not respond', async () => {
        getClient.mockReturnValue({});
        ping.mockResolvedValue(false);
        const result = await service.getStatus();
        expect(result.status).toBe('degraded');
        expect(result.cache.status).toBe('fail');
    });

    it('returns only aggregate infrastructure state, not credentials', async () => {
        const result = await service.getStatus();
        expect(Object.keys(result).sort()).toEqual(['cache', 'database', 'status', 'uptime']);
        expect(Object.keys(result.database).sort()).toEqual(['latency_ms', 'status']);
        expect(Object.keys(result.cache).sort()).toEqual(['latency_ms', 'status']);
    });
});
