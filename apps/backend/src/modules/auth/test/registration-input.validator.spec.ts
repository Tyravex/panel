import { BadRequestException } from '@nestjs/common';
import { validateRegistrationInput } from '../registration-input.validator';

describe('Registration input validation', () => {
    const valid = () => ({
        username: 'new-user_1',
        email: 'new-user@example.invalid',
        password: 'secret-password-123',
    });

    it('accepts valid registration fields without changing their values', () => {
        expect(validateRegistrationInput(valid())).toEqual(valid());
    });

    it.each([
        ['missing body', undefined],
        ['null body', null],
        ['array body', []],
        ['empty body', {}],
        ['short username', { ...valid(), username: 'ab' }],
        ['long username', { ...valid(), username: 'a'.repeat(33) }],
        ['whitespace username', { ...valid(), username: ' new-user' }],
        ['invalid username symbols', { ...valid(), username: 'new.user' }],
        ['missing email', { ...valid(), email: undefined }],
        ['malformed email', { ...valid(), email: 'not-an-email' }],
        ['whitespace email', { ...valid(), email: ' new@example.invalid' }],
        ['oversized email', { ...valid(), email: `${'a'.repeat(250)}@example.invalid` }],
        ['short password', { ...valid(), password: 'short' }],
        ['long password', { ...valid(), password: 'x'.repeat(129) }],
        ['non-string password', { ...valid(), password: [] }],
        ['extra admin field', { ...valid(), isAdmin: true }],
    ])('rejects %s', (_label, input) => {
        expect(() => validateRegistrationInput(input)).toThrow(BadRequestException);
    });
});
