import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodesService } from '../nodes.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';

describe('NodesService updateNode', () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const regionFindUnique = jest.fn();
  const locationFindUnique = jest.fn();
  const queryRaw = jest.fn();
  const transaction = jest.fn();
  const auditCreate = jest.fn();

  let service: NodesService;

  const existingNode = {
    id: 'node-1',
    name: 'Old Node',
    regionId: 'region-1',
    locationId: 'location-1',
    manualAllocationEnabled: true,
    automaticAllocationEnabled: false,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    auditCreate.mockResolvedValue({ id: 'audit-1' });

    findUnique.mockResolvedValue(existingNode);
    regionFindUnique.mockResolvedValue({ id: 'region-1' });
    locationFindUnique.mockResolvedValue({ regionId: 'region-1' });
    queryRaw.mockResolvedValue([{ id: 'node-1' }]);

    update.mockImplementation(async ({ data }) => ({
      ...existingNode,
      ...data,
      status: 'OFFLINE',
    }));

    transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRaw,
        node: { findUnique, update },
        region: { findUnique: regionFindUnique },
        location: { findUnique: locationFindUnique },
        adminAuditLog: { create: auditCreate },
      }),
    );

    service = new NodesService(
      {
        $transaction: transaction,
      } as unknown as PrismaService,
      {} as NodeTokenService,
      {} as NodeHeartbeatMonitorService,
    );
  });

  it('rejects an empty update before opening a transaction', async () => {
    await expect(service.updateNode('node-1', {}, 42)).rejects.toThrow(
      BadRequestException,
    );

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a blank node ID', async () => {
    await expect(
      service.updateNode('  ', { name: 'New Node' }, 42),
    ).rejects.toThrow(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing node', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.updateNode('missing', { name: 'New Node' }, 42),
    ).rejects.toThrow(NotFoundException);

    expect(update).not.toHaveBeenCalled();
  });

  it('updates only the name without changing placement or credentials', async () => {
    await service.updateNode('node-1', { name: '  New Node  ' }, 42);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'node-1' },
        data: { name: 'New Node' },
      }),
    );

    const data = update.mock.calls[0][0].data;

    expect(data).not.toHaveProperty('tokenHash');
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('regionId');
    expect(data).not.toHaveProperty('locationId');
  });

  it('rejects clearing the region while retaining a location', async () => {
    await expect(
      service.updateNode('node-1', { regionId: null }, 42),
    ).rejects.toThrow(BadRequestException);

    expect(update).not.toHaveBeenCalled();
  });

  it('allows clearing both region and location', async () => {
    await service.updateNode('node-1', {
      regionId: null,
      locationId: null,
    }, 42);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          regionId: null,
          locationId: null,
        },
      }),
    );
  });

  it('rejects a location from a different region', async () => {
    regionFindUnique.mockResolvedValue({ id: 'region-2' });
    locationFindUnique.mockResolvedValue({
      regionId: 'region-1',
    });

    await expect(
      service.updateNode('node-1', {
        regionId: 'region-2',
        locationId: 'location-1',
      }, 42),
    ).rejects.toThrow(BadRequestException);

    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a missing region', async () => {
    regionFindUnique.mockResolvedValue(null);

    await expect(
      service.updateNode('node-1', { regionId: 'missing-region' }, 42),
    ).rejects.toThrow(NotFoundException);

    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a missing location', async () => {
    locationFindUnique.mockResolvedValue(null);

    await expect(
      service.updateNode('node-1', { locationId: 'missing-location' }, 42),
    ).rejects.toThrow(NotFoundException);

    expect(update).not.toHaveBeenCalled();
  });

  it('updates a valid region and location together', async () => {
    regionFindUnique.mockResolvedValue({ id: 'region-2' });
    locationFindUnique.mockResolvedValue({
      regionId: 'region-2',
    });

    await service.updateNode('node-1', {
      regionId: 'region-2',
      locationId: 'location-2',
    }, 42);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          regionId: 'region-2',
          locationId: 'location-2',
        },
      }),
    );
  });
  describe('NODE_UPDATED audit', () => {
    it('records actor, target and before/after values', async () => {
      await service.updateNode(
        'node-1',
        { name: '  New Node  ' },
        42,
      );

      expect(auditCreate).toHaveBeenCalledTimes(1);

      expect(auditCreate).toHaveBeenCalledWith({
        data: {
          actorId: 42,
          action: 'NODE_UPDATED',
          targetType: 'NODE',
          targetId: 'node-1',
          metadata: {
            before: {
              name: 'Old Node',
              regionId: 'region-1',
              locationId: 'location-1',
              manualAllocationEnabled: true,
              automaticAllocationEnabled: false,
            },
            after: {
              name: 'New Node',
              regionId: 'region-1',
              locationId: 'location-1',
              manualAllocationEnabled: true,
              automaticAllocationEnabled: false,
            },
          },
        },
      });

      const auditData = auditCreate.mock.calls[0][0].data;

      expect(JSON.stringify(auditData)).not.toContain('tokenHash');
      expect(JSON.stringify(auditData)).not.toContain('secret-token');
    });

    it('does not write audit for an unchanged node', async () => {
      await service.updateNode(
        'node-1',
        { name: '  Old Node  ' },
        42,
      );

      expect(update).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('does not write audit for invalid placement', async () => {
      locationFindUnique.mockResolvedValue({
        regionId: 'different-region',
      });

      await expect(
        service.updateNode(
          'node-1',
          { locationId: 'location-2' },
          42,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(update).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('propagates an audit write failure', async () => {
      const failure = new Error('Audit database unavailable');

      auditCreate.mockRejectedValue(failure);

      await expect(
        service.updateNode(
          'node-1',
          { name: 'New Node' },
          42,
        ),
      ).rejects.toBe(failure);

      expect(update).toHaveBeenCalledTimes(1);
      expect(auditCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('node allocation methods', () => {
    it('enables automatic allocation while preserving manual allocation', async () => {
      await service.updateNode(
        'node-1',
        { automaticAllocationEnabled: true },
        42,
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { automaticAllocationEnabled: true },
        }),
      );

      expect(auditCreate).toHaveBeenCalledTimes(1);
    });

    it('allows automatic-only allocation', async () => {
      findUnique.mockResolvedValue({
        ...existingNode,
        automaticAllocationEnabled: true,
      });

      await service.updateNode(
        'node-1',
        { manualAllocationEnabled: false },
        42,
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { manualAllocationEnabled: false },
        }),
      );
    });

    it('rejects disabling the last allocation method', async () => {
      await expect(
        service.updateNode(
          'node-1',
          { manualAllocationEnabled: false },
          42,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(update).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('rejects disabling both methods simultaneously', async () => {
      await expect(
        service.updateNode(
          'node-1',
          {
            manualAllocationEnabled: false,
            automaticAllocationEnabled: false,
          },
          42,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(update).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('does not update or audit unchanged allocation settings', async () => {
      await service.updateNode(
        'node-1',
        {
          manualAllocationEnabled: true,
          automaticAllocationEnabled: false,
        },
        42,
      );

      expect(update).not.toHaveBeenCalled();
      expect(auditCreate).not.toHaveBeenCalled();
    });
  });
});
