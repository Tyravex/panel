type RuntimeEnvironment = {
    DATABASE_URL?: string;
    PORT?: string;
};

export type RuntimeConfig = {
    databaseUrl: string;
    port: number;
};

export function getRuntimeConfig(
    env: RuntimeEnvironment = {
        DATABASE_URL: process.env.DATABASE_URL,
        PORT: process.env.PORT,
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

    // Reject URL fragments, which are not part of a database connection.
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

    return {
        databaseUrl,
        port,
    };
}
