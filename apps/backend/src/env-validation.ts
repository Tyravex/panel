import { Buffer } from 'node:buffer';

type JwtEnvironment = {
    NODE_ENV?: string;
    JWT_SECRET?: string;
    JWT_REFRESH_SECRET?: string;
};

const MIN_PRODUCTION_SECRET_BYTES = 32;

function validateSecret(
    name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
    value: string | undefined,
    isProduction: boolean,
): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${name} environment variable is required`);
    }

    if (!isProduction) {
        return value;
    }

    if (Buffer.byteLength(value, 'utf8') < MIN_PRODUCTION_SECRET_BYTES) {
        throw new Error(
            `${name} must be at least ${MIN_PRODUCTION_SECRET_BYTES} bytes in production`,
        );
    }

    // Reject common examples and obviously predictable secrets.
    const normalized = value.toLowerCase();

    if (
        /replace|changeme|change_me|placeholder|example|password|secret|your[_-]/.test(
            normalized,
        ) ||
        /^(.)\1+$/.test(value)
    ) {
        throw new Error(
            `${name} contains an insecure or placeholder value in production`,
        );
    }

    return value;
}

export function validateJwtEnvironment(
    env: JwtEnvironment = {
        NODE_ENV: process.env.NODE_ENV,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    },
): void {
    const isProduction = env.NODE_ENV === 'production';

    const accessSecret = validateSecret(
        'JWT_SECRET',
        env.JWT_SECRET,
        isProduction,
    );

    const refreshSecret = validateSecret(
        'JWT_REFRESH_SECRET',
        env.JWT_REFRESH_SECRET,
        isProduction,
    );

    if (accessSecret === refreshSecret) {
        throw new Error(
            'JWT_SECRET and JWT_REFRESH_SECRET must be different',
        );
    }
}
