import { PrismaService } from '@/prisma/prisma.service';
import { ServicesService } from '../services.service';

describe('ServicesService ownership boundaries', () => {
    const findMany = jest.fn();
    let service: ServicesService;

    beforeEach(() => {
        jest.resetAllMocks();
        service = new ServicesService({ service: { findMany } } as unknown as PrismaService);
    });

    it.each([1, 7, 999])('restricts service lookup to owner %i', async (userId) => {
        findMany.mockResolvedValue([]);
        await expect(service.getUserServices(userId)).resolves.toEqual([]);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId },
        }));
    });

    it('selects only public category and server relation fields', async () => {
        findMany.mockResolvedValue([]);
        await service.getUserServices(7);
        expect(findMany).toHaveBeenCalledWith({
            where: { userId: 7 },
            include: {
                category: { select: { key: true, name: true } },
                server: { select: { id: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    });

    it('returns only the records provided by the owner-filtered query', async () => {
        const records = [{ id: 3, userId: 7, category: { key: 'game', name: 'Game' } }];
        findMany.mockResolvedValue(records);
        await expect(service.getUserServices(7)).resolves.toBe(records);
        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('propagates database errors instead of returning unfiltered results', async () => {
        findMany.mockRejectedValue(new Error('Database unavailable'));
        await expect(service.getUserServices(7)).rejects.toThrow('Database unavailable');
        expect(findMany).toHaveBeenCalledTimes(1);
    });
});
