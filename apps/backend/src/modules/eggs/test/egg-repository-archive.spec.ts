import { EggRepositoryArchiveService } from '../catalog/egg-repository-archive.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('Repository archival preserves installation history', () => {
  const db = { $queryRaw: jest.fn(), eggRepository: { findUnique: jest.fn(), update: jest.fn() }, adminAuditLog: { create: jest.fn() } };
  const prisma = { $transaction: (callback: (tx: typeof db) => unknown) => callback(db) };
  const archive = new EggRepositoryArchiveService(prisma as unknown as PrismaService);
  beforeEach(() => jest.resetAllMocks());
  it('only archives and disables the source without touching its Eggs or services', async () => {
    db.eggRepository.findUnique.mockResolvedValue({ id: 'test', isOfficial: false, archivedAt: null });
    expect(await archive.archive('test', 42)).toEqual({ archived: true });
    expect(db.eggRepository.update).toHaveBeenCalledWith({ where: { id: 'test' }, data: { archivedAt: expect.any(Date), status: 'DISABLED', syncClaimUntil: null } });
  });
  it('protects official sources and is idempotent', async () => {
    db.eggRepository.findUnique.mockResolvedValue({ isOfficial: true }); await expect(archive.archive('official', 42)).rejects.toThrow();
    db.eggRepository.findUnique.mockResolvedValue({ isOfficial: false, archivedAt: new Date() }); await archive.archive('test', 42);
    expect(db.eggRepository.update).not.toHaveBeenCalled();
  });
});
