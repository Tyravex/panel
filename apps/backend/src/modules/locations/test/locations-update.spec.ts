import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LocationsService } from '../locations.service';

describe('LocationsService updateLocation', () => {
  const queryRaw = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const nodeCount = jest.fn();
  const regionFindUnique = jest.fn();
  const auditCreate = jest.fn();
  const transaction = jest.fn();

  let service: LocationsService;

  const existing = {
    id: 'location-1',
    name: 'Wodzislaw Slaski',
    code: 'wodzislaw',
    continent: 'Europe',
    country: 'Poland',
    state: 'Silesia',
    city: 'Wodzislaw Slaski',
    regionId: 'region-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();

    queryRaw.mockResolvedValue([{ id: 'location-1' }]);
    findUnique.mockResolvedValue(existing);
    nodeCount.mockResolvedValue(0);
    regionFindUnique.mockResolvedValue({ id: 'region-2' });
    auditCreate.mockResolvedValue({ id: 'audit-1' });

    update.mockImplementation(async ({ data }) => ({
      ...existing,
      ...data,
    }));

    transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRaw,
        location: { findUnique, update },
        node: { count: nodeCount },
        region: { findUnique: regionFindUnique },
        adminAuditLog: { create: auditCreate },
      }),
    );

    service = new LocationsService({
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it('blocks moving a location with assigned nodes', async () => {
    nodeCount.mockResolvedValue(2);

    await expect(
      service.updateLocation(42, 'location-1', {
        regionId: 'region-2',
      }),
    ).rejects.toThrow(ConflictException);

    expect(nodeCount).toHaveBeenCalledWith({
      where: { locationId: 'location-1' },
    });

    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('allows moving a location without assigned nodes', async () => {
    await service.updateLocation(42, 'location-1', {
      regionId: 'region-2',
    });

    expect(nodeCount).toHaveBeenCalledTimes(1);
    expect(regionFindUnique).toHaveBeenCalledWith({
      where: { id: 'region-2' },
      select: { id: true },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'location-1' },
      data: { regionId: 'region-2' },
    });

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 42,
          action: 'LOCATION_UPDATED',
          targetType: 'LOCATION',
          targetId: 'location-1',
          metadata: expect.objectContaining({
            before: expect.objectContaining({
              regionId: 'region-1',
            }),
            after: expect.objectContaining({
              regionId: 'region-2',
            }),
          }),
        }),
      }),
    );
  });

  it('allows changing the name even with assigned nodes', async () => {
    nodeCount.mockResolvedValue(3);

    await service.updateLocation(42, 'location-1', {
      name: 'Nowa nazwa',
    });

    expect(nodeCount).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'location-1' },
      data: { name: 'Nowa nazwa' },
    });

    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('does not block saving the same region', async () => {
    nodeCount.mockResolvedValue(3);

    const result = await service.updateLocation(
      42,
      'location-1',
      { regionId: 'region-1' },
    );

    expect(result).toEqual(existing);
    expect(nodeCount).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing destination region', async () => {
    regionFindUnique.mockResolvedValue(null);

    await expect(
      service.updateLocation(42, 'location-1', {
        regionId: 'missing-region',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
