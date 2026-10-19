
import { validateJwtEnvironment } from '../env-validation';

describe('validateJwtEnvironment', () => {
    const validDevelopmentEnv = {
        NODE_ENV: 'development',
        JWT_SECRET: 'local-access-secret',
        JWT_REFRESH_SECRET: 'local-refresh-secret',
    };

    const validProductionEnv = {
        NODE_ENV: 'production',
        JWT_SECRET:
            'f8C9x2Q7m4T1v6K3p9R5w0Y8n2D7j4H1',
        JWT_REFRESH_SECRET:
            'z3N8b5L0q7W2e9A4t1M6y8P3k5S0c7V2',
    };

    it('accepts valid development secrets', () => {
        expect(() =>
            validateJwtEnvironment(validDevelopmentEnv),
        ).not.toThrow();
    });

    it('accepts short but different secrets in development', () => {
        expect(() =>
            validateJwtEnvironment({
                NODE_ENV: 'development',
                JWT_SECRET: 'abc',
                JWT_REFRESH_SECRET: 'xyz',
            }),
        ).not.toThrow();
    });

    it('accepts valid secrets in test environment', () => {
        expect(() =>
            validateJwtEnvironment({
                NODE_ENV: 'test',
                JWT_SECRET: 'test-access',
                JWT_REFRESH_SECRET: 'test-refresh',
            }),
        ).not.toThrow();
    });

    it('rejects missing JWT_SECRET', () => {
        expect(() =>
            validateJwtEnvironment({
                NODE_ENV: 'development',
                JWT_REFRESH_SECRET: 'refresh',
            }),
        ).toThrow('JWT_SECRET environment variable is required');
    });

    it('rejects missing JWT_REFRESH_SECRET', () => {
        expect(() =>
            validateJwtEnvironment({
                NODE_ENV: 'development',
                JWT_SECRET: 'access',
            }),
        ).toThrow('JWT_REFRESH_SECRET environment variable is required');
    });

    it('rejects an empty JWT_SECRET', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validDevelopmentEnv,
                JWT_SECRET: '',
            }),
        ).toThrow('JWT_SECRET environment variable is required');
    });

    it('rejects an empty JWT_REFRESH_SECRET', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validDevelopmentEnv,
                JWT_REFRESH_SECRET: '',
            }),
        ).toThrow('JWT_REFRESH_SECRET environment variable is required');
    });

    it('rejects whitespace-only access secret', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validDevelopmentEnv,
                JWT_SECRET: '   \t  ',
            }),
        ).toThrow('JWT_SECRET environment variable is required');
    });

    it('rejects whitespace-only refresh secret', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validDevelopmentEnv,
                JWT_REFRESH_SECRET: '   \n ',
            }),
        ).toThrow('JWT_REFRESH_SECRET environment variable is required');
    });

    it('rejects identical secrets in development', () => {
        expect(() =>
            validateJwtEnvironment({
                NODE_ENV: 'development',
                JWT_SECRET: 'same-secret',
                JWT_REFRESH_SECRET: 'same-secret',
            }),
        ).toThrow('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    });

    it('rejects short access secret in production', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validProductionEnv,
                JWT_SECRET: 'too-short',
            }),
        ).toThrow('JWT_SECRET must be at least 32 bytes in production');
    });

    it('rejects short refresh secret in production', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validProductionEnv,
                JWT_REFRESH_SECRET: 'too-short',
            }),
        ).toThrow('JWT_REFRESH_SECRET must be at least 32 bytes in production');
    });

    it('rejects placeholder secrets in production', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validProductionEnv,
                JWT_SECRET: 'replace_with_a_long_random_secret',
            }),
        ).toThrow(
            'JWT_SECRET contains an insecure or placeholder value in production',
        );
    });

    it('rejects repeated-character secrets in production', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validProductionEnv,
                JWT_SECRET: 'a'.repeat(64),
            }),
        ).toThrow(
            'JWT_SECRET contains an insecure or placeholder value in production',
        );
    });

    it('rejects identical secrets in production', () => {
        expect(() =>
            validateJwtEnvironment({
                ...validProductionEnv,
                JWT_REFRESH_SECRET: validProductionEnv.JWT_SECRET,
            }),
        ).toThrow('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    });

    it('accepts valid production secrets', () => {
        expect(() =>
            validateJwtEnvironment(validProductionEnv),
        ).not.toThrow();
    });

    it('does not modify environment values', () => {
        const env = { ...validDevelopmentEnv };

        validateJwtEnvironment(env);

        expect(env).toEqual(validDevelopmentEnv);
    });

    it('does not include secret values in errors', () => {
        const invalidSecret = 'replace_with_a_long_random_secret';

        expect(() =>
            validateJwtEnvironment({
                ...validProductionEnv,
                JWT_SECRET: invalidSecret,
            }),
        ).toThrow(
            expect.not.stringContaining(invalidSecret),
        );
    });
});
