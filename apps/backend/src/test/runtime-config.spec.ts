import { getRuntimeConfig } from '../runtime-config';

describe('getRuntimeConfig environment validation', () => {
    const DATABASE_URL =
        'postgresql://user:password@127.0.0.1:5433/tyravex';

    it.each(['development', 'test', 'production'])(
        'accepts NODE_ENV=%s',
        (NODE_ENV) => {
            expect(() =>
                getRuntimeConfig({ DATABASE_URL, NODE_ENV }),
            ).not.toThrow();
        },
    );

    it('accepts missing NODE_ENV', () => {
        expect(() =>
            getRuntimeConfig({ DATABASE_URL }),
        ).not.toThrow();
    });

    it.each(['', 'staging', 'Production', ' development '])(
        'rejects invalid NODE_ENV=%s',
        (NODE_ENV) => {
            expect(() =>
                getRuntimeConfig({ DATABASE_URL, NODE_ENV }),
            ).toThrow(
                'NODE_ENV must be development, test or production',
            );
        },
    );

    it.each(['true', 'false'])(
        'accepts JOB_WORKER_ENABLED=%s with configured Redis',
        (JOB_WORKER_ENABLED) => {
            expect(() =>
                getRuntimeConfig({
                    DATABASE_URL,
                    JOB_WORKER_ENABLED,
                    REDIS_URL: 'redis://127.0.0.1:6380',
                }),
            ).not.toThrow();
        },
    );

    it('accepts missing JOB_WORKER_ENABLED', () => {
        expect(() =>
            getRuntimeConfig({ DATABASE_URL }),
        ).not.toThrow();
    });

    it.each(['', 'TRUE', '1', 'yes', ' false '])(
        'rejects invalid JOB_WORKER_ENABLED=%s',
        (JOB_WORKER_ENABLED) => {
            expect(() =>
                getRuntimeConfig({ DATABASE_URL, JOB_WORKER_ENABLED }),
            ).toThrow('JOB_WORKER_ENABLED must be true or false');
        },
    );

    it.each([
        'redis://127.0.0.1:6380',
        'rediss://redis.example.com:6380',
        'redis://user:password@localhost:6379/1',
    ])('accepts Redis URL %s', (REDIS_URL) => {
        expect(() =>
            getRuntimeConfig({ DATABASE_URL, REDIS_URL }),
        ).not.toThrow();
    });

    it('accepts missing REDIS_URL when worker is disabled', () => {
        expect(() =>
            getRuntimeConfig({
                DATABASE_URL,
                JOB_WORKER_ENABLED: 'false',
            }),
        ).not.toThrow();
    });

    it.each([
        '',
        'not-a-url',
        'http://localhost:6379',
        'redis:///0',
        'redis://localhost:6379/#fragment',
    ])('rejects invalid REDIS_URL=%s', (REDIS_URL) => {
        expect(() =>
            getRuntimeConfig({ DATABASE_URL, REDIS_URL }),
        ).toThrow('REDIS_URL must be a valid Redis URL');
    });

    it('requires Redis when worker is enabled', () => {
        expect(() =>
            getRuntimeConfig({
                DATABASE_URL,
                JOB_WORKER_ENABLED: 'true',
            }),
        ).toThrow(
            'REDIS_URL is required when JOB_WORKER_ENABLED is true',
        );
    });

    it('accepts enabled worker with configured Redis', () => {
        expect(() =>
            getRuntimeConfig({
                DATABASE_URL,
                JOB_WORKER_ENABLED: 'true',
                REDIS_URL: 'redis://localhost:6380',
            }),
        ).not.toThrow();
    });

    it('does not expose Redis credentials in errors', () => {
        const REDIS_URL =
            'http://user:private-password@localhost:6379';

        expect(() =>
            getRuntimeConfig({ DATABASE_URL, REDIS_URL }),
        ).toThrow('REDIS_URL must be a valid Redis URL');

        try {
            getRuntimeConfig({ DATABASE_URL, REDIS_URL });
        } catch (error) {
            expect((error as Error).message)
                .not.toContain('private-password');
        }
    });
});

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
