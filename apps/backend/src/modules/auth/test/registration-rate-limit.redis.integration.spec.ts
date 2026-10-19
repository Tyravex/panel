import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { RegistrationRateLimitStore } from '../registration-rate-limit.store';

// Run only against a dedicated local Redis test instance.
// Set REDIS_TEST_URL explicitly; never use the application's REDIS_URL.
const testUrl = process.env.REDIS_TEST_URL;
const isLocalRedis = (() => {
    if (!testUrl) return false;
    try {
        const host = new URL(testUrl).hostname;
        return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
    } catch {
        return false;
    }
})();

const describeRedis = isLocalRedis ? describe : describe.skip;

describeRedis('RegistrationRateLimitStore - real Redis integration', () => {
    let client: Redis;
    const stores: RegistrationRateLimitStore[] = [];

    const createStore = (): RegistrationRateLimitStore => {
        const config = { get: (key: string) => key === 'REDIS_URL' ? testUrl : undefined } as ConfigService;
        const store = new RegistrationRateLimitStore(config);
        stores.push(store);
        return store;
    };

    beforeAll(async () => {
        client = new Redis(testUrl!, {
            connectTimeout: 1500,
            maxRetriesPerRequest: 0,
            retryStrategy: () => null,
        });
        await client.ping();
    });

    afterAll(async () => {
        await Promise.all(stores.map((store) => store.onModuleDestroy()));
        client?.disconnect();
    });

    it('allows 20 attempts and rejects attempt 21 across two store instances', async () => {
        const ip = `integration-${randomUUID()}`;
        const first = createStore();
        const second = createStore();
        for (let i = 0; i < 20; i++) {
            const result = await (i % 2 === 0 ? first : second).consume(ip);
            expect(result.allowed).toBe(true);
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.retryAfter).toBeLessThanOrEqual(900);
        }
        const blocked = await second.consume(ip);
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfter).toBeGreaterThan(0);
        expect(blocked.retryAfter).toBeLessThanOrEqual(900);
    });

    it('isolates counters for different socket addresses', async () => {
        const store = createStore();
        const firstIp = `integration-${randomUUID()}`;
        const secondIp = `integration-${randomUUID()}`;
        for (let i = 0; i < 21; i++) await store.consume(firstIp);
        expect((await store.consume(firstIp)).allowed).toBe(false);
        expect((await store.consume(secondIp)).allowed).toBe(true);
    });

    it('enforces the limit under concurrent requests', async () => {
        const ip = `integration-${randomUUID()}`;
        const first = createStore();
        const second = createStore();
        const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
            (i % 2 === 0 ? first : second).consume(ip),
        ));
        expect(results.filter((result) => result.allowed)).toHaveLength(20);
        expect(results.filter((result) => !result.allowed)).toHaveLength(20);
    });

    it('fails closed when Redis is unavailable', async () => {
        const config = { get: (key: string) => key === 'REDIS_URL' ? 'redis://127.0.0.1:1' : undefined } as ConfigService;
        const store = new RegistrationRateLimitStore(config);
        try {
            await expect(store.consume(`integration-${randomUUID()}`))
                .rejects.toBeInstanceOf(ServiceUnavailableException);
        } finally {
            await store.onModuleDestroy();
        }
    });
});
