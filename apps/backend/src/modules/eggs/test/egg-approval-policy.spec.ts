import { ConflictException } from '@nestjs/common';

import { assertEggApproved } from '../egg-approval.policy';

describe('Egg approval policy', () => {
    it('accepts approved Eggs', () => {
        expect(() =>
            assertEggApproved('APPROVED'),
        ).not.toThrow();
    });

    it('rejects pending Eggs', () => {
        expect(() =>
            assertEggApproved('PENDING'),
        ).toThrow(ConflictException);
    });

    it('rejects rejected Eggs', () => {
        expect(() =>
            assertEggApproved('REJECTED'),
        ).toThrow(ConflictException);
    });

    it('returns a conflict response for unapproved Eggs', () => {
        try {
            assertEggApproved('PENDING');
            fail('Expected approval validation to fail');
        } catch (error) {
            expect(error).toBeInstanceOf(ConflictException);
            expect(
                (error as ConflictException).getStatus(),
            ).toBe(409);
        }
    });
});
