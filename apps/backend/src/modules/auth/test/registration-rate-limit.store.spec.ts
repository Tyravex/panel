import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { RegistrationRateLimitStore } from '../registration-rate-limit.store';

jest.mock('ioredis');
const RedisMock = Redis as unknown as jest.Mock;

describe('RegistrationRateLimitStore', () => {
    const evalMock = jest.fn();
    const connect = jest.fn();
    const disconnect = jest.fn();
    const on = jest.fn();
    const config = { get: jest.fn().mockReturnValue('redis://localhost:6379') } as unknown as ConfigService;
    beforeEach(() => {
        jest.resetAllMocks();
        (config.get as jest.Mock).mockReturnValue('redis://localhost:6379');
        RedisMock.mockImplementation(() => ({ status: 'ready', eval: evalMock, connect, disconnect, on }));
    });
    it('accepts attempts 1 through 20 and rejects attempt 21 using atomic Redis results', async () => {
        const store = new RegistrationRateLimitStore(config);
        for (let i = 1; i <= 21; i++) {
            evalMock.mockResolvedValueOnce([i, 900]);
            const result = await store.consume('192.0.2.10');
            expect(result.allowed).toBe(i <= 20);
        }
        expect(evalMock).toHaveBeenCalledTimes(21);
        expect(evalMock.mock.calls[0][0]).toContain("redis.call('INCR'");
        expect(evalMock.mock.calls[0][2]).toMatch(/^registration:rate:[a-f0-9]{64}$/);
        expect(evalMock.mock.calls[0][3]).toBe(900);
        await store.onModuleDestroy();
        expect(disconnect).toHaveBeenCalled();
    });
    it('shares the same key between store instances', async () => {
        const first = new RegistrationRateLimitStore(config);
        const second = new RegistrationRateLimitStore(config);
        evalMock.mockResolvedValue([1, 900]);
        await first.consume('192.0.2.10');
        await second.consume('192.0.2.10');
        expect(evalMock.mock.calls[0][2]).toBe(evalMock.mock.calls[1][2]);
        await first.onModuleDestroy(); await second.onModuleDestroy();
    });
    it('fails closed without configuration', async () => {
        (config.get as jest.Mock).mockReturnValue(undefined);
        const store = new RegistrationRateLimitStore(config);
        await expect(store.consume('192.0.2.10')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('fails closed on Redis errors', async () => {
        const store = new RegistrationRateLimitStore(config);
        evalMock.mockRejectedValue(new Error('Redis unavailable'));
        await expect(store.consume('192.0.2.10')).rejects.toBeInstanceOf(ServiceUnavailableException);
        await store.onModuleDestroy();
    });
});
