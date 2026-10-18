import { ExecutionContext, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { RegistrationRateLimitGuard } from '../guards/registration-rate-limit.guard';
import { RegistrationRateLimitStore } from '../registration-rate-limit.store';

describe('RegistrationRateLimitGuard', () => {
    const consume = jest.fn();
    const setHeader = jest.fn();
    const request = { socket: { remoteAddress: '192.0.2.10' }, headers: { 'x-forwarded-for': '192.0.2.99' } };
    const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader }) }) } as unknown as ExecutionContext;
    const guard = new RegistrationRateLimitGuard({ consume } as unknown as RegistrationRateLimitStore);
    beforeEach(() => { jest.resetAllMocks(); consume.mockResolvedValue({ allowed: true, retryAfter: 900 }); });

    it('allows requests and uses socket IP, ignoring forwarded headers', async () => {
        await expect(guard.canActivate(context)).resolves.toBe(true);
        expect(consume).toHaveBeenCalledWith('192.0.2.10');
    });
    it('rejects exceeded limits with 429 and Retry-After', async () => {
        consume.mockResolvedValue({ allowed: false, retryAfter: 123 });
        await expect(guard.canActivate(context)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
        expect(setHeader).toHaveBeenCalledWith('Retry-After', '123');
    });
    it('fails closed when the store is unavailable', async () => {
        consume.mockRejectedValue(new ServiceUnavailableException('Registration temporarily unavailable'));
        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
});
