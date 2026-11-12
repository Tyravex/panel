import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { NodeTokenService } from '../node-token.service';
import { NodesService } from '../nodes.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';

describe('NodesService security boundaries', () => {
  const create = jest.fn();
  const regionFindUnique = jest.fn();
  const locationFindUnique = jest.fn();
  const transaction = jest.fn();
  const update = jest.fn();
  const findUnique = jest.fn();
  const generateToken = jest.fn();
  const hashToken = jest.fn();
  const verifyToken = jest.fn();
  const expireStaleNodes = jest.fn();

  let service: NodesService;

  beforeEach(() => {
    jest.resetAllMocks();

    transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          node: { create },
          region: { findUnique: regionFindUnique },
          $queryRaw: jest.fn().mockResolvedValue([{ id: "location-1" }]),
          location: { findUnique: locationFindUnique },
        }),
    );

    generateToken.mockReturnValue('secret-token');
    hashToken.mockReturnValue('hashed-token');

    service = new NodesService(
      {
        node: { create, update, findUnique },
        $transaction: transaction,
      } as unknown as PrismaService,
      {
        generateToken,
        hashToken,
        verifyToken,
      } as unknown as NodeTokenService,
      {
        expireStaleNodes,
      } as unknown as NodeHeartbeatMonitorService,
    );
  });

  it.each(['', '   ', 'x'.repeat(101)])(
    'rejects invalid node name before generating a token',
    async (name) => {
      await expect(service.createNode(name)).rejects.toThrow(
        BadRequestException,
      );
      expect(generateToken).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('trims names and persists only the hashed token', async () => {
    create.mockResolvedValue({
      id: 'node-1',
      name: 'Node',
      status: 'OFFLINE',
    });

    await expect(service.createNode('  Node  ')).resolves.toEqual({
      id: 'node-1',
      name: 'Node',
      status: 'OFFLINE',
      token: 'secret-token',
    });

    expect(hashToken).toHaveBeenCalledWith('secret-token');
    expect(transaction).toHaveBeenCalledTimes(1);

    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Node',
        tokenHash: 'hashed-token',
        regionId: null,
        locationId: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
        regionId: true,
        locationId: true,
        createdAt: true,
      },
    });

    expect(regionFindUnique).not.toHaveBeenCalled();
    expect(locationFindUnique).not.toHaveBeenCalled();
  });

  it('requires a region when creating a node with a location', async () => {
    await expect(
      service.createNode({
        name: 'Node',
        locationId: 'location-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(create).not.toHaveBeenCalled();
    expect(generateToken).not.toHaveBeenCalled();
  });

  it('rejects a region that does not exist', async () => {
    regionFindUnique.mockResolvedValue(null);

    await expect(
      service.createNode({
        name: 'Node',
        regionId: 'missing-region',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a location that does not exist', async () => {
    regionFindUnique.mockResolvedValue({ id: 'region-1' });
    locationFindUnique.mockResolvedValue(null);

    await expect(
      service.createNode({
        name: 'Node',
        regionId: 'region-1',
        locationId: 'missing-location',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a location belonging to another region', async () => {
    regionFindUnique.mockResolvedValue({ id: 'region-1' });
    locationFindUnique.mockResolvedValue({
      regionId: 'region-2',
    });

    await expect(
      service.createNode({
        name: 'Node',
        regionId: 'region-1',
        locationId: 'location-2',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(create).not.toHaveBeenCalled();
  });

  it('creates a node with a matching region and location', async () => {
    regionFindUnique.mockResolvedValue({ id: 'region-1' });
    locationFindUnique.mockResolvedValue({
      regionId: 'region-1',
    });

    create.mockResolvedValue({
      id: 'node-1',
      name: 'Node',
      status: 'OFFLINE',
      regionId: 'region-1',
      locationId: 'location-1',
    });

    await expect(
      service.createNode({
        name: 'Node',
        regionId: 'region-1',
        locationId: 'location-1',
      }),
    ).resolves.toEqual({
      id: 'node-1',
      name: 'Node',
      status: 'OFFLINE',
      regionId: 'region-1',
      locationId: 'location-1',
      token: 'secret-token',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'Node',
          tokenHash: 'hashed-token',
          regionId: 'region-1',
          locationId: 'location-1',
        },
      }),
    );
  });

  it('rejects blank node IDs before rotating credentials', async () => {
    await expect(service.rotateToken('  ')).rejects.toThrow(
      BadRequestException,
    );

    expect(generateToken).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not mask unexpected database errors during rotation', async () => {
    const failure = new Error('Database unavailable');

    update.mockRejectedValue(failure);

    await expect(service.rotateToken('node-1')).rejects.toBe(failure);
  });

  it('maps a missing node during rotation to 404', async () => {
    update.mockRejectedValue({ code: 'P2025' });

    await expect(service.rotateToken('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([
    ['', 'token'],
    ['node-1', ''],
    ['node-1', undefined],
  ])(
    'rejects missing node credentials without database lookup',
    async (id, token) => {
      await expect(
        service.authenticateNode(id, token as string),
      ).resolves.toBeNull();

      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown nodes without attempting token verification', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.authenticateNode('missing', 'token'),
    ).resolves.toBeNull();

    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('never exposes tokenHash in successful node authentication', async () => {
    findUnique.mockResolvedValue({
      id: 'node-1',
      name: 'Node',
      status: 'ONLINE',
      tokenHash: 'stored-hash',
    });

    verifyToken.mockReturnValue(true);

    const result = await service.authenticateNode('node-1', 'secret-token');

    expect(verifyToken).toHaveBeenCalledWith('secret-token', 'stored-hash');

    expect(result).toEqual({
      id: 'node-1',
      name: 'Node',
      status: 'ONLINE',
    });

    expect(result).not.toHaveProperty('tokenHash');
  });
});
