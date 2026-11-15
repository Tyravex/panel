import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RemoteJsonService } from '@/infrastructure/http/remote-json.service';
import { EggRepositorySyncService } from '../egg-repository-sync.service';
import { TYRAVEX_EGGS_INDEX } from '../catalog/egg-source';

describe('Egg repository synchronization', () => {
  const manifest = { format: 'tyravex-egg', formatVersion: 1, id: 'sample', name: 'Sample', version: '1.0.0', category: 'server',
    runtime: { image: 'alpine:3.21', startup: 'echo test' }, resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 } };
  const repository = { id: 'repo-1', url: 'https://example.com/catalog/index.json', status: 'ENABLED' };
  const db = { eggRepository: { findUnique: jest.fn() }, egg: { findFirst: jest.fn(), create: jest.fn() }, panelSetting: { findUnique: jest.fn() },
    $queryRaw: jest.fn(), adminAuditLog: { create: jest.fn() } };
  const prisma = { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) };
  const remote = { getJson: jest.fn() };
  const sync = new EggRepositorySyncService(prisma as unknown as PrismaService, remote as unknown as RemoteJsonService);
  beforeEach(() => {
    jest.resetAllMocks(); db.eggRepository.findUnique.mockResolvedValue(repository); db.egg.findFirst.mockResolvedValue(null);
    remote.getJson.mockImplementation((url: string) => Promise.resolve(url === repository.url
      ? { format: 'tyravex-egg-repository', schemaVersion: 1, eggs: ['eggs/sample.json'] } : manifest));
  });
  it('loads relative manifests and previews without writing to storage', async () => {
    const result = await sync.preview('repo-1');
    expect(result.entries[0]).toMatchObject({ path: 'eggs/sample.json', state: 'NEW', key: 'sample' });
    expect(remote.getJson).toHaveBeenCalledWith('https://example.com/catalog/eggs/sample.json');
    expect(db.egg.create).not.toHaveBeenCalled();
  });
  it('rejects cross-origin manifest paths', async () => {
    remote.getJson.mockResolvedValue({ format: 'tyravex-egg-repository', schemaVersion: 1, eggs: ['https://evil.com/egg.json'] });
    await expect(sync.preview('repo-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(remote.getJson).toHaveBeenCalledTimes(1);
  });
  it('never fetches a disabled source', async () => {
    db.eggRepository.findUnique.mockResolvedValue({ ...repository, status: 'DISABLED' });
    await expect(sync.preview('repo-1')).rejects.toBeInstanceOf(ConflictException);
    expect(remote.getJson).not.toHaveBeenCalled();
  });
  it('imports selected definitions as pending and disabled', async () => {
    expect(await sync.sync(42, 'repo-1', ['eggs/sample.json'], (await sync.preview('repo-1')).digest)).toEqual({ imported: 1, skipped: 0 });
    expect(db.egg.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approvalStatus: 'PENDING', isEnabled: false, sourceType: 'COMMUNITY' }) }));
    expect(db.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });
  it('skips identical versions independent of JSON object property order', async () => {
    db.egg.findFirst.mockResolvedValue({ manifest: Object.fromEntries(Object.entries(manifest).reverse()) });
    expect(await sync.sync(42, 'repo-1', ['eggs/sample.json'], (await sync.preview('repo-1')).digest)).toEqual({ imported: 0, skipped: 1 });
    expect(db.egg.create).not.toHaveBeenCalled();
  });
  it('does not overwrite a conflicting existing version', async () => {
    db.egg.findFirst.mockResolvedValue({ manifest: { ...manifest, name: 'Changed upstream' } });
    await expect(sync.sync(42, 'repo-1', ['eggs/sample.json'], (await sync.preview('repo-1')).digest)).rejects.toBeInstanceOf(ConflictException);
    expect(db.egg.create).not.toHaveBeenCalled();
  });
  it('rejects a changed manifest after preview before writing', async () => {
    const preview = await sync.preview('repo-1');
    remote.getJson.mockImplementation((url: string) => Promise.resolve(url === repository.url
      ? { format: 'tyravex-egg-repository', schemaVersion: 1, eggs: ['eggs/sample.json'] } : { ...manifest, name: 'Changed' }));
    await expect(sync.sync(42, 'repo-1', ['eggs/sample.json'], preview.digest)).rejects.toBeInstanceOf(ConflictException);
    expect(db.egg.create).not.toHaveBeenCalled();
  });
  it('shows invalid manifests individually without discarding the entire preview', async () => {
    remote.getJson.mockImplementation((url: string) => Promise.resolve(url === repository.url
      ? { format: 'tyravex-egg-repository', schemaVersion: 1, eggs: ['eggs/sample.json'] } : { invalid: true }));
    const preview = await sync.preview('repo-1');
    expect(preview.entries[0]).toMatchObject({ state: 'INVALID', manifest: null });
    await expect(sync.sync(42, 'repo-1', ['eggs/sample.json'], preview.digest)).rejects.toBeInstanceOf(ConflictException);
  });
  it('rechecks the setting inside the import transaction for automatic runs', async () => {
    db.panelSetting.findUnique.mockResolvedValue({ booleanValue: false });
    const preview = await sync.preview('repo-1');
    await expect(sync.sync(null, 'repo-1', ['eggs/sample.json'], preview.digest, true)).rejects.toBeInstanceOf(ConflictException);
    expect(db.egg.create).not.toHaveBeenCalled();
  });
  it('never trusts an official flag on a noncanonical automatic source', async () => {
    db.panelSetting.findUnique.mockResolvedValue({ booleanValue: true });
    db.eggRepository.findUnique.mockResolvedValue({ ...repository, isOfficial: true });
    const preview = await sync.preview('repo-1');
    await expect(sync.sync(null, 'repo-1', ['eggs/sample.json'], preview.digest, true)).rejects.toBeInstanceOf(ConflictException);
    expect(db.egg.create).not.toHaveBeenCalled();
  });
  it('records verified official provenance while retaining pending review and disabled status', async () => {
    db.panelSetting.findUnique.mockResolvedValue({ booleanValue: true });
    db.eggRepository.findUnique.mockResolvedValue({ ...repository, isOfficial: true, url: TYRAVEX_EGGS_INDEX });
    remote.getJson.mockImplementation((url: string) => Promise.resolve(url.includes('/commits/') ? { sha: 'a'.repeat(40) }
      : url.endsWith('/registry.json') ? { schemaVersion: 1, eggs: ['eggs/sample.json'] } : manifest));
    const preview = await sync.preview('repo-1');
    await sync.sync(null, 'repo-1', ['eggs/sample.json'], preview.digest, true);
    expect(db.egg.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceType: 'OFFICIAL', approvalStatus: 'PENDING', isEnabled: false }) }));
  });
});
