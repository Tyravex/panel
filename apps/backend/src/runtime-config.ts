
type RuntimeEnvironment = {
    DATABASE_URL?: string;
    PORT?: string;
    NODE_ENV?: string;
    REDIS_URL?: string;
    JOB_WORKER_ENABLED?: string;
};

export type RuntimeConfig = {
    databaseUrl: string;
    port: number;
};

export function getRuntimeConfig(
    env: RuntimeEnvironment = {
        DATABASE_URL: process.env.DATABASE_URL,
        PORT: process.env.PORT,
        NODE_ENV: process.env.NODE_ENV,
        REDIS_URL: process.env.REDIS_URL,
        JOB_WORKER_ENABLED: process.env.JOB_WORKER_ENABLED,
    },
): RuntimeConfig {
    const databaseUrl = env.DATABASE_URL;

    if (
        typeof databaseUrl !== 'string' ||
        databaseUrl.trim().length === 0
    ) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    let parsed: URL;

    try {
        parsed = new URL(databaseUrl);
    } catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }

    if (
        !['postgresql:', 'postgres:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        !parsed.pathname ||
        parsed.pathname === '/' ||
        !parsed.pathname.slice(1)
    ) {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }

    if (parsed.hash) {
        throw new Error('DATABASE_URL must not contain a fragment');
    }

    const configuredPort = env.PORT;
    let port = 3000;

    if (configuredPort !== undefined) {
        if (
            typeof configuredPort !== 'string' ||
            !/^[0-9]+$/.test(configuredPort)
        ) {
            throw new Error('PORT must be an integer between 1 and 65535');
        }

        port = Number(configuredPort);

        if (
            !Number.isSafeInteger(port) ||
            port < 1 ||
            port > 65535
        ) {
            throw new Error('PORT must be an integer between 1 and 65535');
        }
    }

    if (
        env.NODE_ENV !== undefined &&
        !['development', 'test', 'production'].includes(env.NODE_ENV)
    ) {
        throw new Error(
            'NODE_ENV must be development, test or production',
        );
    }

    if (
        env.JOB_WORKER_ENABLED !== undefined &&
        env.JOB_WORKER_ENABLED !== 'true' &&
        env.JOB_WORKER_ENABLED !== 'false'
    ) {
        throw new Error(
            'JOB_WORKER_ENABLED must be true or false',
        );
    }

    if (env.REDIS_URL !== undefined) {
        let redisUrl: URL;

        try {
            redisUrl = new URL(env.REDIS_URL);
        } catch {
            throw new Error('REDIS_URL must be a valid Redis URL');
        }

        if (
            !['redis:', 'rediss:'].includes(redisUrl.protocol) ||
            !redisUrl.hostname ||
            redisUrl.hash
        ) {
            throw new Error('REDIS_URL must be a valid Redis URL');
        }
    }

    if (
        env.JOB_WORKER_ENABLED === 'true' &&
        !env.REDIS_URL
    ) {
        throw new Error(
            'REDIS_URL is required when JOB_WORKER_ENABLED is true',
        );
    }

    return {
        databaseUrl,
        port,
    };
}
