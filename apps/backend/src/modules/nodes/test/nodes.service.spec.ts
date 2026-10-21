import { UnauthorizedException } from '@nestjs/common';
import { NodesService } from '../nodes.service';
import { NodeTokenService } from '../node-token.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('NodesService - heartbeat', () => {
  const nodeId = 'test-node-id';
  const validToken = 'a'.repeat(64);

  let service: NodesService;
  let tokenService: NodeTokenService;

  let prisma: {
    node: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      node: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    tokenService = new NodeTokenService();

    service = new NodesService(
      prisma as unknown as PrismaService,
      tokenService,
    );
  });

  function mockNode(status = 'OFFLINE') {
    return {
      id: nodeId,
      tokenHash: tokenService.hashToken(validToken),
      status,
    };
  }

  it('accepts a valid heartbeat and marks the node ONLINE', async () => {
    prisma.node.findUnique.mockResolvedValue(mockNode());
    prisma.node.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.heartbeat(nodeId, validToken);

    expect(result.ok).toBe(true);
    expect(new Date(result.lastSeenAt).toString()).not.toBe('Invalid Date');

    expect(prisma.node.updateMany).toHaveBeenCalledWith({
      where: {
        id: nodeId,
        tokenHash: tokenService.hashToken(validToken),
        status: { not: 'MAINTENANCE' },
      },
      data: {
        status: 'ONLINE',
        lastSeenAt: expect.any(Date) as Date,
      },
    });
  });

  it('rejects an invalid token', async () => {
    prisma.node.findUnique.mockResolvedValue(mockNode());

    await expect(
      service.heartbeat(nodeId, 'b'.repeat(64)),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.node.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a missing token', async () => {
    await expect(service.heartbeat(nodeId, '')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.node.findUnique).not.toHaveBeenCalled();
    expect(prisma.node.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a node that does not exist', async () => {
    prisma.node.findUnique.mockResolvedValue(null);

    await expect(service.heartbeat(nodeId, validToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.node.updateMany).not.toHaveBeenCalled();
  });

  it('preserves MAINTENANCE status while updating lastSeenAt', async () => {
    prisma.node.findUnique.mockResolvedValue(mockNode('MAINTENANCE'));

    prisma.node.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await service.heartbeat(nodeId, validToken);

    expect(result.ok).toBe(true);
    expect(prisma.node.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: nodeId,
        tokenHash: tokenService.hashToken(validToken),
        status: 'MAINTENANCE',
      },
      data: {
        lastSeenAt: expect.any(Date) as Date,
      },
    });
  });

  it('rejects a heartbeat when the token was rotated during the request', async () => {
    prisma.node.findUnique.mockResolvedValue(mockNode());

    prisma.node.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(service.heartbeat(nodeId, validToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('marks stale ONLINE nodes as OFFLINE before listing them', async () => {
    prisma.node.updateMany.mockResolvedValue({ count: 1 });
    prisma.node.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.node.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'ONLINE',
        OR: [
          { lastSeenAt: null },
          {
            lastSeenAt: {
              lt: expect.any(Date) as Date,
            },
          },
        ],
      },
      data: {
        status: 'OFFLINE',
      },
    });

    expect(prisma.node.findMany).toHaveBeenCalled();
  });

  it('checks stale nodes before fetching a single node', async () => {
    prisma.node.updateMany.mockResolvedValue({ count: 0 });
    prisma.node.findUnique.mockResolvedValue(mockNode());

    await service.findById(nodeId);

    expect(prisma.node.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.node.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: nodeId },
      }),
    );
  });
});
