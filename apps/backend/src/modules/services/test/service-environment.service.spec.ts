import { ServiceEnvironmentService } from '../configuration/service-environment.service';
import { encryptServiceEnvironment, decryptServiceEnvironment } from '../configuration/service-environment.crypto';
import { PrismaService } from '@/prisma/prisma.service';

describe('Service environment storage boundaries', () => {
  const originalKey = process.env.SERVICE_ENVIRONMENT_KEY;
  const manifest = { format: 'tyravex-egg', formatVersion: 1, id: 'bot', name: 'Bot', version: '1.0.0', category: 'discord_bot',
    runtime: { image: 'node:22', startup: 'npm start' }, resources: { memoryMb: 512, cpuPercent: 100, diskMb: 1024 }, variables: [{ name: 'TOKEN', required: true, secret: true }] };
  const db = { service: { findUnique: jest.fn(), update: jest.fn() }, serviceEggConfiguration: { upsert: jest.fn() }, adminAuditLog: { create: jest.fn() }, $queryRaw: jest.fn(), job: { findFirst: jest.fn() } };
  const prisma = { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) };
  const environment = new ServiceEnvironmentService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks(); process.env.SERVICE_ENVIRONMENT_KEY = 'ab'.repeat(32);
    db.service.findUnique.mockResolvedValue({ id: 'service-1', installStatus: 'DRAFT', egg: { manifest }, eggConfiguration: null });
  });
  afterAll(() => { if (originalKey === undefined) delete process.env.SERVICE_ENVIRONMENT_KEY; else process.env.SERVICE_ENVIRONMENT_KEY = originalKey; });
  it('returns configured names without returning ciphertext or secret values', async () => {
    db.service.findUnique.mockResolvedValue({ egg: { manifest }, eggConfiguration: { environmentEncrypted: encryptServiceEnvironment('service-1', { TOKEN: 'secret-token' }) } });
    const metadata = await environment.metadata('service-1');
    expect(metadata).toEqual({ configured: ['TOKEN'], required: ['TOKEN'], missing: [] });
    expect(JSON.stringify(metadata)).not.toContain('secret-token');
  });
  it('encrypts before persistence and audits names only', async () => {
    expect(await environment.update(42, 'service-1', { TOKEN: 'secret-token' })).toEqual({ configured: ['TOKEN'] });
    const data = db.serviceEggConfiguration.upsert.mock.calls[0][0].update;
    expect(decryptServiceEnvironment('service-1', data.environmentEncrypted)).toEqual({ TOKEN: 'secret-token' });
    expect(JSON.stringify(db.adminAuditLog.create.mock.calls)).not.toContain('secret-token');
    expect(JSON.stringify(db.serviceEggConfiguration.upsert.mock.calls)).not.toContain('secret-token');
  });
  it('rejects undeclared variables and writes nothing', async () => {
    await expect(environment.update(42, 'service-1', { NODE_OPTIONS: '--require /evil.js' })).rejects.toThrow();
    expect(db.serviceEggConfiguration.upsert).not.toHaveBeenCalled();
  });
  it('removes values only through explicit null updates and preserves untouched values', async () => {
    db.service.findUnique.mockResolvedValue({ installStatus: 'DRAFT', egg: { manifest }, eggConfiguration: { environmentEncrypted: encryptServiceEnvironment('service-1', { TOKEN: 'secret-token' }) } });
    expect(await environment.update(42, 'service-1', {})).toEqual({ configured: ['TOKEN'] });
    expect(await environment.update(42, 'service-1', { TOKEN: null })).toEqual({ configured: [] });
  });
  it('does not mutate installed service environments', async () => {
    db.service.findUnique.mockResolvedValue({ installStatus: 'INSTALLED' });
    await expect(environment.update(42, 'service-1', { TOKEN: 'secret-token' })).rejects.toThrow();
    expect(db.serviceEggConfiguration.upsert).not.toHaveBeenCalled();
  });
});
