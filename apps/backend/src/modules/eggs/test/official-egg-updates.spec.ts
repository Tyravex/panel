import { OfficialEggUpdateService } from '../settings/official-egg-update.service';
import { EggUpdateSettingsService } from '../settings/egg-update-settings.service';
import { EggRepositorySyncService } from '../egg-repository-sync.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TYRAVEX_EGGS_INDEX } from '../catalog/egg-source';

describe('Official Egg update coordination', () => {
  const db = { eggRepository: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() } };
  const settings = { enabled: jest.fn() }; const sync = { preview: jest.fn(), sync: jest.fn() };
  const worker = new OfficialEggUpdateService(db as unknown as PrismaService, sync as unknown as EggRepositorySyncService, settings as unknown as EggUpdateSettingsService);
  beforeEach(() => {
    jest.resetAllMocks(); settings.enabled.mockResolvedValue(true); db.eggRepository.updateMany.mockResolvedValue({ count: 1 });
    db.eggRepository.findMany.mockResolvedValue([{ id: 'official-1' }]);
    sync.preview.mockResolvedValue({ digest: 'reviewed-digest', entries: [{ key: 'bot', version: '1.0.0', path: 'bot.json', state: 'NEW' }] });
    sync.sync.mockResolvedValue({ imported: 1 });
  });
  it('performs no network checks or claims when the setting is disabled', async () => {
    settings.enabled.mockResolvedValue(false);
    await worker.tick(); expect(sync.preview).not.toHaveBeenCalled(); expect(db.eggRepository.updateMany).not.toHaveBeenCalled();
  });
  it('claims only the enabled canonical official source and imports as a system action', async () => {
    await worker.tick();
    expect(db.eggRepository.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isOfficial: true, url: TYRAVEX_EGGS_INDEX, status: 'ENABLED', archivedAt: null } }));
    expect(sync.sync).toHaveBeenCalledWith(null, 'official-1', ['bot.json'], 'reviewed-digest', true);
    expect(db.eggRepository.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'official-1', syncClaimUntil: expect.any(Date) }), data: { syncClaimUntil: null } }));
  });
  it('does not run a duplicate check when another process owns the lease', async () => {
    db.eggRepository.updateMany.mockResolvedValue({ count: 0 });
    await worker.tick(); expect(sync.preview).not.toHaveBeenCalled();
  });
  it('checks the setting again after preview and never imports after disable', async () => {
    settings.enabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await worker.tick(); expect(sync.preview).toHaveBeenCalled(); expect(sync.sync).not.toHaveBeenCalled();
  });
  it('manual checks update version metadata without importing', async () => {
    expect(await worker.refresh('official-1')).toMatchObject({ checked: 1, imported: 0 });
    expect(sync.sync).not.toHaveBeenCalled();
    expect(db.eggRepository.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ latestVersions: { bot: '1.0.0' } }) }));
  });
});
