import { BadRequestException } from '@nestjs/common';

import { NodesService } from '../nodes.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';

describe('NodesService ownership assignments', () => {
    const findMany = jest.fn();

    let service: NodesService;

    beforeEach(() => {
        jest.clearAllMocks();

        const prisma = {
            service: {
                findMany,
            },
        } as unknown as PrismaService;

        service = new NodesService(
            prisma,
            {} as NodeTokenService,
            {} as NodeHeartbeatMonitorService,
        );
    });

    it('reads service IDs assigned to the requested node', async () => {
        findMany.mockResolvedValue([
            { id: 'service-1' },
            { id: 'service-2' },
        ]);

        const result =
            await service.findAssignedServiceIds('node-1');

        expect(result).toEqual([
            'service-1',
            'service-2',
        ]);

        expect(findMany).toHaveBeenCalledTimes(1);
        expect(findMany).toHaveBeenCalledWith({
            where: {
                nodeId: 'node-1',
            },
            select: {
                id: true,
            },
            orderBy: {
                id: 'asc',
            },
            take: 4097,
        });
    });

    it('returns an empty array when no services are assigned', async () => {
        findMany.mockResolvedValue([]);

        const result =
            await service.findAssignedServiceIds('node-1');

        expect(result).toEqual([]);
        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('requests one extra record to detect the ownership limit', async () => {
        const records = Array.from(
            { length: 4097 },
            (_, index) => ({
                id: `service-${index + 1}`,
            }),
        );

        findMany.mockResolvedValue(records);

        const result =
            await service.findAssignedServiceIds('node-1');

        expect(result).toHaveLength(4097);
        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 4097,
            }),
        );
    });

    it.each([
        '',
        '   ',
    ])('rejects an invalid node ID: %j', async (nodeId) => {
        await expect(
            service.findAssignedServiceIds(nodeId),
        ).rejects.toThrow(BadRequestException);

        expect(findMany).not.toHaveBeenCalled();
    });

    it('propagates database errors without returning partial assignments', async () => {
        findMany.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await expect(
            service.findAssignedServiceIds('node-1'),
        ).rejects.toThrow('Database unavailable');

        expect(findMany).toHaveBeenCalledTimes(1);
    });
});
