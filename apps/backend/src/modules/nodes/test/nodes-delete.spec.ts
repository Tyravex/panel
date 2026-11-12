import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';
import { NodesService } from '../nodes.service';

describe('NodesService deleteNode', () => {
  const actorId = 7;
  const nodeId = 'node-test-1';

  const existingNode = {
    id: nodeId,
    name: 'Test Node',
    status: 'OFFLINE',
    regionId: 'region-1',
    locationId: 'location-1',
  };

  const lock = jest.fn();
  const findUnique = jest.fn();
  const serviceCount = jest.fn();
  const commandCount = jest.fn();
  const nodeDelete = jest.fn();
  const auditCreate = jest.fn();

  const tx = {
    $queryRaw: lock,
    node: {
      findUnique,
      delete: nodeDelete,
    },
    service: {
      count: serviceCount,
    },
    agentCommand: {
      count: commandCount,
    },
    adminAuditLog: {
      create: auditCreate,
    },
  };

  const transaction = jest.fn();

  const service = new NodesService(
    { $transaction: transaction } as unknown as PrismaService,
    {} as NodeTokenService,
    {} as NodeHeartbeatMonitorService,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    lock.mockResolvedValue([{ id: nodeId }]);
    findUnique.mockResolvedValue(existingNode);
    serviceCount.mockResolvedValue(0);
    commandCount.mockResolvedValue(0);
    nodeDelete.mockResolvedValue(existingNode);
    auditCreate.mockResolvedValue({ id: 'audit-1' });

    transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
  });

  it('rejects an empty Node ID', async () => {
    await expect(service.deleteNode('', actorId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns 404 when Node does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.deleteNode(nodeId, actorId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(nodeDelete).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('blocks deletion when services are assigned', async () => {
    serviceCount.mockResolvedValue(2);

    await expect(
      service.deleteNode(nodeId, actorId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(commandCount).not.toHaveBeenCalled();
    expect(nodeDelete).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('blocks deletion when Agent command history exists', async () => {
    commandCount.mockResolvedValue(1);

    await expect(
      service.deleteNode(nodeId, actorId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(nodeDelete).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('deletes an unused Node and records an audit entry', async () => {
    await expect(
      service.deleteNode(nodeId, actorId),
    ).resolves.toEqual({ success: true });

    expect(lock).toHaveBeenCalledTimes(1);
    expect(serviceCount).toHaveBeenCalledWith({
      where: { nodeId },
    });
    expect(commandCount).toHaveBeenCalledWith({
      where: { nodeId },
    });
    expect(nodeDelete).toHaveBeenCalledWith({
      where: { id: nodeId },
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId,
        action: 'NODE_DELETED',
        targetType: 'NODE',
        targetId: nodeId,
        metadata: {
          name: existingNode.name,
          status: existingNode.status,
          regionId: existingNode.regionId,
          locationId: existingNode.locationId,
        },
      },
    });
  });

  it.each([
    ['P2003', ConflictException],
    ['P2034', ConflictException],
    ['P2025', NotFoundException],
  ])('maps Prisma error %s correctly', async (code, exception) => {
    nodeDelete.mockRejectedValue({ code });

    await expect(
      service.deleteNode(nodeId, actorId),
    ).rejects.toBeInstanceOf(exception);

    expect(auditCreate).not.toHaveBeenCalled();
  });
});