import { EggTagsService } from '../catalog/egg-tags.service';
import { PrismaService } from '@/prisma/prisma.service';
import { inferSystemEggTags, newerEggVersion } from '../catalog/egg-system-tags';
import type { EggManifest } from '@shared/types';

describe('Egg tags and privacy', () => {
  const db = { $queryRaw: jest.fn(), eggTag: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn() },
    egg: { findUnique: jest.fn() }, eggTagAssignment: { deleteMany: jest.fn(), createMany: jest.fn() }, adminAuditLog: { create: jest.fn() } };
  const prisma = { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) };
  const tags = new EggTagsService(prisma as unknown as PrismaService);
  const user = { id: 42, permissions: [] };
  beforeEach(() => { jest.resetAllMocks(); db.eggTag.count.mockResolvedValue(0); db.eggTag.create.mockResolvedValue({ id: 'tag-1', name: 'My tag', color: 'blue', ownerId: 42 }); });
  it('lets ordinary users create personal tags while rejecting shared scope', async () => {
    await tags.create(user, { name: 'My tag', color: 'blue' });
    expect(db.eggTag.create).toHaveBeenCalledWith({ data: { name: 'My tag', slug: 'my tag', color: 'blue', ownerId: 42, scopeKey: 'user:42' } });
    await expect(tags.create(user, { name: 'Global', color: 'blue', shared: true })).rejects.toThrow();
  });
  it('does not allow deleting system or another user’s private tags', async () => {
    await expect(tags.remove(user, 'system:discord-bot')).rejects.toThrow();
    db.eggTag.findUnique.mockResolvedValue({ id: 'tag-2', ownerId: 99 });
    await expect(tags.remove({ id: 42, permissions: ['egg:manage'] }, 'tag-2')).rejects.toThrow();
    expect(db.eggTag.delete).not.toHaveBeenCalled();
  });
  it('allows recoloring owned tags while keeping scope immutable', async () => {
    db.eggTag.findUnique.mockResolvedValue({ id: 'tag-1', ownerId: 42 });
    db.eggTag.update.mockResolvedValue({ id: 'tag-1', ownerId: 42, name: 'Renamed', color: 'rose' });
    await tags.update(user, 'tag-1', { name: 'Renamed', color: 'rose' });
    expect(db.eggTag.update).toHaveBeenCalledWith({ where: { id: 'tag-1' }, data: { name: 'Renamed', slug: 'renamed', color: 'rose' } });
    await expect(tags.update(user, 'tag-1', { name: 'Renamed', color: 'rose', shared: false })).rejects.toThrow();
    await expect(tags.update(user, 'system:nodejs', { name: 'Changed', color: 'rose' })).rejects.toThrow();
  });
  it('limits assignment to owned custom Eggs or administrators', async () => {
    db.egg.findUnique.mockResolvedValue({ sourceType: 'CUSTOM', ownerId: 99 });
    await expect(tags.assign(user, 'egg-1', [])).rejects.toThrow();
    db.egg.findUnique.mockResolvedValue({ sourceType: 'CUSTOM', ownerId: 42 }); db.eggTag.findMany.mockResolvedValue([{ id: 'tag-1' }]);
    await tags.assign(user, 'egg-1', ['tag-1']);
    expect(db.eggTagAssignment.deleteMany).toHaveBeenCalledWith({ where: { eggId: 'egg-1', tag: { OR: [{ ownerId: null }, { ownerId: 42 }] } } });
  });
  it('rejects arbitrary colors, duplicate tag assignments and missing private IDs', async () => {
    await expect(tags.create(user, { name: 'Tag', color: 'bg-[url(evil)]' })).rejects.toThrow();
    await expect(tags.assign(user, 'egg-1', ['tag-1', 'tag-1'])).rejects.toThrow();
    db.egg.findUnique.mockResolvedValue({ sourceType: 'CUSTOM', ownerId: 42 }); db.eggTag.findMany.mockResolvedValue([]);
    await expect(tags.assign(user, 'egg-1', ['private-tag'])).rejects.toThrow();
    expect(db.eggTagAssignment.deleteMany).not.toHaveBeenCalled();
  });
  it('infers stable colored system tags and compares versions numerically', () => {
    const manifest = { category: 'discord_bot', runtime: { image: 'node:22' } } as EggManifest;
    expect(inferSystemEggTags('bot', 'Bot', manifest).map((tag) => tag.id)).toEqual(['system:discord-bot', 'system:nodejs']);
    expect(newerEggVersion('1.10.0', '1.9.0')).toBe(true);
    expect(newerEggVersion('1.2.0', '1.10.0')).toBe(false);
    expect(newerEggVersion('latest', '1.0.0')).toBe(false);
  });
});
