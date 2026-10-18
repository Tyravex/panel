import { BadRequestException } from '@nestjs/common';

export interface RegistrationInput {
    username: string;
    email: string;
    password: string;
}

// Keep validation identical for HTTP and direct service calls.
export function validateRegistrationInput(input: unknown): RegistrationInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new BadRequestException('Invalid registration input');
    }

    const fields = input as Record<string, unknown>;
    const allowed = ['username', 'email', 'password'];
    if (Object.keys(fields).some((key) => !allowed.includes(key))) {
        throw new BadRequestException('Unexpected registration field');
    }

    const { username, email, password } = fields;
    if (typeof username !== 'string' ||
        !/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
        throw new BadRequestException('Invalid username');
    }

    if (typeof email !== 'string' || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Invalid email');
    }

    if (typeof password !== 'string' ||
        password.length < 12 || password.length > 128) {
        throw new BadRequestException('Invalid password');
    }

    return { username, email, password };
}
