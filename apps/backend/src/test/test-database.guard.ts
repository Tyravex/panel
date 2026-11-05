/**
 * Fail closed before any PostgreSQL integration test connects.
 * Never fall back to the application DATABASE_URL.
 */
export function requireIntegrationDatabase(): string {
    const value = process.env.TEST_DATABASE_URL;
    if (!value) throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests.');
    let test: URL;
    try { test = new URL(value); } catch { throw new Error('Invalid TEST_DATABASE_URL.'); }
    if (!['postgres:', 'postgresql:'].includes(test.protocol) ||
        !['localhost', '127.0.0.1'].includes(test.hostname) ||
        test.port !== '55433' ||
        test.pathname !== '/tyravex_integration' ||
        test.username !== 'tyravex_test' ||
        test.searchParams.get('schema') !== 'public') {
        throw new Error('Only local tyravex_integration (user tyravex_test, schema public) is permitted.');
    }
    if (process.env.DATABASE_URL) {
        let application: URL;
        try { application = new URL(process.env.DATABASE_URL); }
        catch { throw new Error('Invalid application DATABASE_URL.'); }
        const identity = (url: URL) => [url.hostname.toLowerCase(), url.port || '5432', decodeURIComponent(url.pathname), url.searchParams.get('schema') || 'public'].join('|');
        if (identity(application) === identity(test) && process.env.TYRAVEX_TEST_DATABASE_ACTIVE !== '1') {
            throw new Error('TEST_DATABASE_URL targets the application database. Refusing to continue.');
        }
    }
    return value;
}
