import { decryptServiceEnvironment, encryptServiceEnvironment } from '../configuration/service-environment.crypto';

describe('Encrypted service environment', () => {
  const previous = process.env.SERVICE_ENVIRONMENT_KEY;
  beforeEach(() => { process.env.SERVICE_ENVIRONMENT_KEY = 'ab'.repeat(32); });
  afterAll(() => { if (previous === undefined) delete process.env.SERVICE_ENVIRONMENT_KEY; else process.env.SERVICE_ENVIRONMENT_KEY = previous; });
  it('round-trips secret values without exposing them in ciphertext', () => {
    const envelope = encryptServiceEnvironment('service-1', { DISCORD_TOKEN: 'private-token' });
    expect(envelope).not.toContain('private-token');
    expect(decryptServiceEnvironment('service-1', envelope)).toEqual({ DISCORD_TOKEN: 'private-token' });
    expect(encryptServiceEnvironment('service-1', { DISCORD_TOKEN: 'private-token' })).not.toEqual(envelope);
  });
  it('rejects ciphertext substitution across services and changed authentication tags', () => {
    const envelope = encryptServiceEnvironment('service-1', { TOKEN: 'private-token' });
    expect(() => decryptServiceEnvironment('service-2', envelope)).toThrow();
    const parts = envelope.split('.'); parts[2] = Buffer.alloc(16).toString('base64');
    expect(() => decryptServiceEnvironment('service-1', parts.join('.'))).toThrow();
  });
  it('requires a dedicated valid key and does not include secret values in errors', () => {
    delete process.env.SERVICE_ENVIRONMENT_KEY;
    expect(() => encryptServiceEnvironment('service-1', { TOKEN: 'private-token' })).toThrow('SERVICE_ENVIRONMENT_KEY');
    expect(() => decryptServiceEnvironment('service-1', 'v1.bad.tag.secret')).toThrow('Service environment is unavailable');
  });
});
