import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminServicesService } from '../admin-services.service';

describe('Administrative draft service configuration', () => {
  const manifest = { format: 'tyravex-egg', formatVersion: 1, id: 'sample', name: 'Sample', version: '1.0.0', category: 'server',
    runtime: { image: 'alpine:3.21', startup: 'echo test' }, resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 } };
  const tx = {
    $queryRaw: jest.fn(), service: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    serviceCategory: { findUnique: jest.fn() }, node: { findUnique: jest.fn() }, user: { findFirst: jest.fn() },
    egg: { findUnique: jest.fn() }, adminAuditLog: { create: jest.fn() },
  };
  const prisma = { $transaction: (callback: (db: typeof tx) => unknown) => callback(tx) };
  const service = new AdminServicesService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks(); tx.$queryRaw.mockResolvedValue([{ id: 'service-1' }]);
    tx.serviceCategory.findUnique.mockResolvedValue({ id: 'category-1', key: 'server' });
    tx.node.findUnique.mockResolvedValue({ id: 'node-1' });
    tx.service.create.mockResolvedValue({ id: 'service-1' });
    tx.egg.findUnique.mockResolvedValue({ id: 'egg-1', key: 'sample', version: '1.0.0', manifest,
      repositoryId: 'repository-1', isEnabled: true, approvalStatus: 'APPROVED', repository: { status: 'ENABLED' } });
  });
  it('creates the draft and pins an approved compatible Egg with resource defaults', async () => {
    await service.save(42, { name: ' New service ', categoryKey: 'server', eggId: 'egg-1' });
    expect(tx.service.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      name: 'New service', eggId: 'egg-1', installStatus: 'DRAFT', userId: null, dockerImage: 'alpine:3.21', memoryMb: 512,
    }) }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });
  it('rejects unapproved Eggs before creating a service', async () => {
    tx.egg.findUnique.mockResolvedValue({ repositoryId: 'repo', approvalStatus: 'PENDING', isEnabled: true, repository: { status: 'ENABLED' } });
    await expect(service.save(42, { name: 'Service', categoryKey: 'server', eggId: 'egg-1' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.service.create).not.toHaveBeenCalled();
  });
  it('rejects category mismatches and does not create partial drafts', async () => {
    await expect(service.save(42, { name: 'Bot', categoryKey: 'discord_bot', eggId: 'egg-1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.service.create).not.toHaveBeenCalled();
  });
  it('does not change configuration for installed services', async () => {
    tx.service.findUnique.mockResolvedValue({ id: 'service-1', installStatus: 'INSTALLED' });
    await expect(service.save(42, { name: 'Changed' }, 'service-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.service.update).not.toHaveBeenCalled();
  });
  it('rejects stale updates before making changes', async () => {
    tx.service.findUnique.mockResolvedValue({ id: 'service-1', installStatus: 'DRAFT', updatedAt: new Date('2026-11-14T10:00:00Z') });
    await expect(service.save(42, { name: 'Changed', expectedUpdatedAt: 'old-version' }, 'service-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.service.update).not.toHaveBeenCalled();
  });
});
