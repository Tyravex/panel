export function getCorsOrigins(
    configuredOrigins: string | undefined = process.env.CORS_ORIGIN,
): string[] {
    if (!configuredOrigins) {
        throw new Error('CORS_ORIGIN environment variable is required');
    }

    const origins = configuredOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (origins.length === 0) {
        throw new Error('CORS_ORIGIN must contain at least one origin');
    }

    for (const origin of origins) {
        let parsed: URL;

        try {
            parsed = new URL(origin);
        } catch {
            throw new Error(`Invalid CORS origin: ${origin}`);
        }

        if (
            !['http:', 'https:'].includes(parsed.protocol) ||
            parsed.origin !== origin ||
            parsed.username ||
            parsed.password ||
            origin === 'null'
        ) {
            throw new Error(`Invalid CORS origin: ${origin}`);
        }
    }

    return [...new Set(origins)];
}
