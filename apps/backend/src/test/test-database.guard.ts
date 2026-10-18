/**
 * Prevent PostgreSQL integration tests from accessing a non-test database.
 * Call this before constructing PrismaClient or PrismaService.
 */
export function requireIntegrationDatabase(): string {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
    }

    let databaseName: string;
    try {
        const url = new URL(connectionString);
        if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
            throw new Error('Unsupported database protocol');
        }
        databaseName = decodeURIComponent(url.pathname.slice(1));
    } catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
    }

    if (databaseName !== 'tyravex_rbac_test') {
        throw new Error(
            'Integration tests require the isolated tyravex_rbac_test database.',
        );
    }

    return connectionString;
}
