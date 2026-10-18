import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RegistrationRateLimitGuard } from '../guards/registration-rate-limit.guard';

describe('RegistrationRateLimitGuard', () => {
    let guard: RegistrationRateLimitGuard;
    let now: jest.SpyInstance;
    const headers: Record<string, string> = {};
    const request = { socket: { remoteAddress: '192.0.2.10' }, ip: '192.0.2.10' };
    const response = { setHeader: jest.fn((name: string, value: string) => { headers[name] = value; }) };
    const context = {
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ExecutionContext;

    beforeEach(() => {
        guard = new RegistrationRateLimitGuard();
        Object.keys(headers).forEach((key) => delete headers[key]);
        response.setHeader.mockClear();
        now = jest.spyOn(Date, 'now').mockReturnValue(1000000);
        request.socket.remoteAddress = '192.0.2.10';
    });
    afterEach(() => now.mockRestore());

    it('allows 20 attempts and rejects the 21st with Retry-After', () => {
        for (let i = 0; i < 20; i++) expect(guard.canActivate(context)).toBe(true);
        expect(() => guard.canActivate(context)).toThrow(HttpException);
        expect(headers['Retry-After']).toBe('900');
        try {
            guard.canActivate(context);
        } catch (error) {
            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        }
    });

    it('resets the limit after 15 minutes', () => {
        for (let i = 0; i < 20; i++) guard.canActivate(context);
        now.mockReturnValue(1000000 + 15 * 60 * 1000);
        expect(guard.canActivate(context)).toBe(true);
    });

    it('tracks separate IPs independently', () => {
        for (let i = 0; i < 20; i++) guard.canActivate(context);
        request.socket.remoteAddress = '192.0.2.11';
        expect(guard.canActivate(context)).toBe(true);
    });

    it('ignores spoofable forwarding headers', () => {
        const spoofed = { ...request, headers: { 'x-forwarded-for': '192.0.2.99' } };
        const ctx = { switchToHttp: () => ({ getRequest: () => spoofed, getResponse: () => response }) } as unknown as ExecutionContext;
        for (let i = 0; i < 20; i++) guard.canActivate(ctx);
        spoofed.headers['x-forwarded-for'] = '192.0.2.100';
        expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    });
});
