import { getRuntimeConfig } from '../runtime-config';

describe('getRuntimeConfig', () => {
  const validDatabaseUrl =
    'postgresql://user:password@127.0.0.1:5433/tyravex';

  it('accepts a valid PostgreSQL URL and port', () => {
    expect(
      getRuntimeConfig({
        DATABASE_URL: validDatabaseUrl,
        PORT: '3000',
      }),
    ).toEqual({
      databaseUrl: validDatabaseUrl,
      port: 3000,
    });
  });

  it('accepts the postgres protocol', () => {
    expect(
      getRuntimeConfig({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/tyravex',
      }).port,
    ).toBe(3000);
  });

  it('accepts PostgreSQL query parameters', () => {
    const url = `${validDatabaseUrl}?schema=public`;

    expect(getRuntimeConfig({ DATABASE_URL: url }).databaseUrl)
      .toBe(url);
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => getRuntimeConfig({ PORT: '3000' }))
      .toThrow('DATABASE_URL environment variable is required');
  });

  it('rejects empty DATABASE_URL', () => {
    expect(() =>
      getRuntimeConfig({ DATABASE_URL: '' }),
    ).toThrow('DATABASE_URL environment variable is required');
  });

  it('rejects whitespace-only DATABASE_URL', () => {
    expect(() =>
      getRuntimeConfig({ DATABASE_URL: '   ' }),
    ).toThrow('DATABASE_URL environment variable is required');
  });

  it('rejects invalid DATABASE_URL syntax', () => {
    expect(() =>
      getRuntimeConfig({ DATABASE_URL: 'not-a-url' }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
  });

  it('rejects unsupported database protocols', () => {
    expect(() =>
      getRuntimeConfig({
        DATABASE_URL: 'mysql://user:pass@localhost/database',
      }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
  });

  it('rejects missing database name', () => {
    expect(() =>
      getRuntimeConfig({
        DATABASE_URL: 'postgresql://localhost:5432/',
      }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
  });

  it('rejects missing database host', () => {
    expect(() =>
      getRuntimeConfig({
        DATABASE_URL: 'postgresql:///tyravex',
      }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
  });

  it('rejects database URL fragments', () => {
    expect(() =>
      getRuntimeConfig({
        DATABASE_URL: `${validDatabaseUrl}#fragment`,
      }),
    ).toThrow('DATABASE_URL must not contain a fragment');
  });

  it('uses port 3000 when PORT is missing', () => {
    expect(
      getRuntimeConfig({ DATABASE_URL: validDatabaseUrl }).port,
    ).toBe(3000);
  });

  it('accepts minimum port 1', () => {
    expect(
      getRuntimeConfig({
        DATABASE_URL: validDatabaseUrl,
        PORT: '1',
      }).port,
    ).toBe(1);
  });

  it('accepts maximum port 65535', () => {
    expect(
      getRuntimeConfig({
        DATABASE_URL: validDatabaseUrl,
        PORT: '65535',
      }).port,
    ).toBe(65535);
  });

  it.each([
    ['empty', ''],
    ['zero', '0'],
    ['negative', '-1'],
    ['above maximum', '65536'],
    ['text', 'abc'],
    ['decimal', '3000.5'],
    ['whitespace', ' 3000 '],
    ['scientific notation', '3e3'],
    ['infinity', 'Infinity'],
  ])('rejects %s PORT', (_description, port) => {
    expect(() =>
      getRuntimeConfig({
        DATABASE_URL: validDatabaseUrl,
        PORT: port,
      }),
    ).toThrow('PORT must be an integer between 1 and 65535');
  });

  it('does not modify environment values', () => {
    const env = {
      DATABASE_URL: validDatabaseUrl,
      PORT: '3000',
    };

    getRuntimeConfig(env);

    expect(env).toEqual({
      DATABASE_URL: validDatabaseUrl,
      PORT: '3000',
    });
  });

  it('does not expose database credentials in errors', () => {
    const invalidUrl = 'postgresql://private-password';

    try {
      getRuntimeConfig({ DATABASE_URL: invalidUrl });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect((error as Error).message)
        .not.toContain('private-password');
    }
  });
});
