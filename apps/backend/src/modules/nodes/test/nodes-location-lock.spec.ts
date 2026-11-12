import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodesService } from '../nodes.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';

describe('NodesService location locking', () => {
  const events: string[] = [];

  const queryRaw = jest.fn();
  const nodeCreate = jest.fn();
  const nodeFindUnique = jest.fn();
  const nodeUpdate = jest.fn();
  const regionFindUnique = jest.fn();
  const locationFindUnique = jest.fn();
  const auditCreate = jest.fn();
  const transaction = jest.fn();

  let service: NodesService;

  beforeEach(() => {
    jest.resetAllMocks();
    events.length = 0;

    queryRaw.mockImplementation(async () => {
      events.push('lock');
      return [{ id: 'location-1' }];
    });

    regionFindUnique.mockResolvedValue({ id: 'region-1' });

    locationFindUnique.mockImplementation(async () => {
      events.push('read-location');
      return { regionId: 'region-1' };
    });

    nodeCreate.mockImplementation(async ({ data }) => ({
      id: 'node-new',
      name: data.name,
      status: 'OFFLINE',
      regionId: data.regionId,
      locationId: data.locationId,
    }));

    nodeFindUnique.mockResolvedValue({
      id: 'node-1',
      name: 'Node 1',
      regionId: 'region-1',
      locationId: null,
      status: 'OFFLINE',
      manualAllocationEnabled: true,
      automaticAllocationEnabled: false,
    });

    nodeUpdate.mockImplementation(async ({ data }) => ({
      id: 'node-1',
      name: 'Node 1',
      regionId: 'region-1',
      locationId: 'location-1',
      status: 'OFFLINE',
      ...data,
    }));

    auditCreate.mockResolvedValue({ id: 'audit-1' });

    transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRaw,
        region: { findUnique: regionFindUnique },
        location: { findUnique: locationFindUnique },
        node: {
          create: nodeCreate,
          findUnique: nodeFindUnique,
          update: nodeUpdate,
        },
        adminAuditLog: { create: auditCreate },
      }),
    );

    const tokenService = {
      generateToken: jest.fn().mockReturnValue('secret-token'),
      hashToken: jest.fn().mockReturnValue('hashed-token'),
    };

    service = new NodesService(
      { $transaction: transaction } as unknown as PrismaService,
      tokenService as unknown as NodeTokenService,
      {} as NodeHeartbeatMonitorService,
    );
  });

  describe('node creation allocation methods', () => {
    it('uses manual-only allocation by default', async () => {
      const result = await service.createNode({
        name: 'Default Node',
      });

      expect(nodeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manualAllocationEnabled: true,
            automaticAllocationEnabled: false,
          }),
        }),
      );

      expect(result.token).toBe('secret-token');
      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it('supports explicit manual-only allocation', async () => {
      await service.createNode({
        name: 'Manual Node',
        manualAllocationEnabled: true,
        automaticAllocationEnabled: false,
      });

      expect(nodeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manualAllocationEnabled: true,
            automaticAllocationEnabled: false,
          }),
        }),
      );
    });

    it('supports automatic-only allocation', async () => {
      await service.createNode({
        name: 'Automatic Node',
        manualAllocationEnabled: false,
        automaticAllocationEnabled: true,
      });

      expect(nodeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manualAllocationEnabled: false,
            automaticAllocationEnabled: true,
          }),
        }),
      );
    });

    it('supports both allocation methods enabled', async () => {
      await service.createNode({
        name: 'Combined Node',
        manualAllocationEnabled: true,
        automaticAllocationEnabled: true,
      });

      expect(nodeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manualAllocationEnabled: true,
            automaticAllocationEnabled: true,
          }),
        }),
      );
    });

    it('rejects both allocation methods disabled', async () => {
      await expect(
        service.createNode({
          name: 'Invalid Node',
          manualAllocationEnabled: false,
          automaticAllocationEnabled: false,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(nodeCreate).not.toHaveBeenCalled();
    });

    it('rejects non-boolean allocation settings', async () => {
      await expect(
        service.createNode({
          name: 'Invalid Type Node',
          manualAllocationEnabled: 'false' as unknown as boolean,
          automaticAllocationEnabled: true,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(transaction).not.toHaveBeenCalled();
      expect(nodeCreate).not.toHaveBeenCalled();
    });
  });
  it('locks location before checking region on node creation', async () => {
    await service.createNode({
      name: 'New Node',
      regionId: 'region-1',
      locationId: 'location-1',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['lock', 'read-location']);
    expect(nodeCreate).toHaveBeenCalledTimes(1);
  });

  it('locks location before checking region on node update', async () => {
    await service.updateNode(
      'node-1',
      { locationId: 'location-1' },
      42,
    );

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(events).toEqual(['lock', 'lock', 'read-location']);
    expect(nodeUpdate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects creation if region changed before location read', async () => {
    locationFindUnique.mockImplementation(async () => {
      events.push('read-location');
      return { regionId: 'region-2' };
    });

    await expect(
      service.createNode({
        name: 'New Node',
        regionId: 'region-1',
        locationId: 'location-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(events).toEqual(['lock', 'read-location']);
    expect(nodeCreate).not.toHaveBeenCalled();
  });

  it('rejects update if region changed before location read', async () => {
    locationFindUnique.mockImplementation(async () => {
      events.push('read-location');
      return { regionId: 'region-2' };
    });

    await expect(
      service.updateNode(
        'node-1',
        { locationId: 'location-1' },
        42,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(events).toEqual(['lock', 'lock', 'read-location']);
    expect(nodeUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('does not lock a location when creating a node without one', async () => {
    await service.createNode({
      name: 'Unassigned Node',
    });

    expect(queryRaw).not.toHaveBeenCalled();
    expect(locationFindUnique).not.toHaveBeenCalled();
    expect(nodeCreate).toHaveBeenCalledTimes(1);
  });
});
