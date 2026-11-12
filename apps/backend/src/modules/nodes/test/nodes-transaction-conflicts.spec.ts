import { ConflictException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NodesService } from '../nodes.service';
import { NodeTokenService } from '../node-token.service';
import { NodeHeartbeatMonitorService } from '../services/node-heartbeat-monitor.service';
import { LocationsService } from '../../locations/locations.service';

describe('Infrastructure transaction conflicts', () => {
  const transaction = jest.fn();
  const generateToken = jest.fn();
  const hashToken = jest.fn();

  let nodes: NodesService;
  let locations: LocationsService;

  const conflict = () =>
    new Prisma.PrismaClientKnownRequestError(
      'Transaction conflict',
      {
        code: 'P2034',
        clientVersion: '7.4.0',
      },
    );

  beforeEach(() => {
    jest.resetAllMocks();

    generateToken.mockReturnValue('test-token');
    hashToken.mockReturnValue('test-hash');

    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaService;

    nodes = new NodesService(
      prisma,
      {
        generateToken,
        hashToken,
      } as unknown as NodeTokenService,
      {} as NodeHeartbeatMonitorService,
    );

    locations = new LocationsService(prisma);
    transaction.mockImplementation(async () => {
      throw conflict();
    });
  });

  async function expectConflict(
    operation: Promise<unknown>,
  ): Promise<void> {
    try {
      await operation;
      throw new Error('Expected transaction conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getStatus()).toBe(
        HttpStatus.CONFLICT,
      );
    }
  }

  it('returns 409 for node creation without retry', async () => {
    await expectConflict(nodes.createNode('Node 1'));
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('returns 409 for node update without retry', async () => {
    await expectConflict(
      nodes.updateNode('node-1', { name: 'Node 2' }, 42),
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('returns 409 for location update without retry', async () => {
    await expectConflict(
      locations.updateLocation(42, 'location-1', {
        name: 'Updated Location',
      }),
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not translate unrelated node transaction errors', async () => {
    const original = new Error('Unexpected database error');
    transaction.mockRejectedValue(original);

    await expect(nodes.createNode('Node 1')).rejects.toBe(
      original,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not translate unrelated location transaction errors', async () => {
    const original = new Error('Unexpected database error');
    transaction.mockRejectedValue(original);

    await expect(
      locations.updateLocation(42, 'location-1', {
        name: 'Updated Location',
      }),
    ).rejects.toBe(original);

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
