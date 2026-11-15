import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EggsService } from '../eggs.service';

describe('Immutable administrative Egg versions', () => {
  const manifest = { format: 'tyravex-egg', formatVersion: 1, id: 'sample', name: 'Sample', version: '1.0.0', category: 'server',
    runtime: { image: 'alpine:3.21', startup: 'echo test' }, resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 } };
  const findUnique = jest.fn();
  const service = new EggsService({ egg: { findUnique } } as unknown as PrismaService);
  beforeEach(() => { jest.restoreAllMocks(); findUnique.mockResolvedValue({ id: 'egg-1', key: 'sample', version: '1.0.0', repositoryId: 'repo-1', sourceType: 'COMMUNITY', ownerId: null }); });
  it('rejects overwriting the same version', async () => {
    await expect(service.createVersion(42, 'egg-1', manifest)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects changing the Egg identity', async () => {
    await expect(service.createVersion(42, 'egg-1', { ...manifest, id: 'other', version: '1.0.1' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('creates a separate version without modifying the existing record', async () => {
    const importer = jest.spyOn(service, 'importEgg').mockResolvedValue({ id: 'new-egg' } as never);
    await service.createVersion(42, 'egg-1', { ...manifest, version: '1.0.1' });
    expect(importer).toHaveBeenCalledWith(42, 'repo-1', expect.objectContaining({ version: '1.0.1' }), undefined);
  });
});
