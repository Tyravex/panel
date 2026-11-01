import {
    isPublicRegistryIp,
    isSafeCommunityHttpsUrl,
    parseCommunityRegistry,
} from '../marketplace-community-registry.validation';

const validPlugin = {
    id: 'community.example',
    name: 'Community Example',
    description: 'Example community plugin',
    type: 'extension',
    version: '1.0.0',
    downloadUrl: 'https://downloads.example.org/plugin.zip',
    sha256: 'a'.repeat(64),
};

describe('Community registry validation', () => {
    describe('IP validation', () => {
        it.each([
            '127.0.0.1',
            '10.0.0.1',
            '172.16.0.1',
            '192.168.1.1',
            '169.254.169.254',
            '100.100.100.100',
            '192.0.2.1',
            '198.18.0.1',
            '198.51.100.1',
            '203.0.113.1',
            '224.0.0.1',
            '240.0.0.1',
            '::1',
            '::ffff:127.0.0.1',
        ])('rejects non-public IP %s', (ip) => {
            expect(isPublicRegistryIp(ip)).toBe(false);
        });

        it.each([
            '1.1.1.1',
            '8.8.8.8',
            '9.9.9.9',
        ])('accepts public IPv4 %s', (ip) => {
            expect(isPublicRegistryIp(ip)).toBe(true);
        });
    });

    describe('URL validation', () => {
        it.each([
            'http://plugins.example.org/registry.json',
            'https://localhost/registry.json',
            'https://127.0.0.1/registry.json',
            'https://192.168.1.1/registry.json',
            'https://plugins.example.org:8443/registry.json',
            'https://user:pass@plugins.example.org/registry.json',
            'https://plugins.example.org/registry.json?token=123',
            'https://plugins.example.org/registry.json#fragment',
            'https://plugins.local/registry.json',
            'https://plugins.internal/registry.json',
        ])('rejects unsafe URL %s', (url) => {
            expect(isSafeCommunityHttpsUrl(url)).toBe(false);
        });

        it('accepts a public HTTPS hostname', () => {
            expect(
                isSafeCommunityHttpsUrl(
                    'https://plugins.example.org/registry.json',
                ),
            ).toBe(true);
        });
    });

    describe('registry schema', () => {
        it('accepts a valid registry', () => {
            expect(
                parseCommunityRegistry({
                    schemaVersion: 1,
                    plugins: [validPlugin],
                }),
            ).toEqual({
                schemaVersion: 1,
                plugins: [validPlugin],
            });
        });

        it('rejects invalid schema versions', () => {
            expect(() =>
                parseCommunityRegistry({
                    schemaVersion: 2,
                    plugins: [],
                }),
            ).toThrow();
        });

        it('rejects duplicate plugin IDs', () => {
            expect(() =>
                parseCommunityRegistry({
                    schemaVersion: 1,
                    plugins: [validPlugin, validPlugin],
                }),
            ).toThrow();
        });

        it('rejects invalid SHA256', () => {
            expect(() =>
                parseCommunityRegistry({
                    schemaVersion: 1,
                    plugins: [
                        {
                            ...validPlugin,
                            sha256: 'invalid',
                        },
                    ],
                }),
            ).toThrow();
        });

        it('rejects unsafe download URLs', () => {
            expect(() =>
                parseCommunityRegistry({
                    schemaVersion: 1,
                    plugins: [
                        {
                            ...validPlugin,
                            downloadUrl: 'http://localhost/plugin.zip',
                        },
                    ],
                }),
            ).toThrow();
        });

        it('rejects more than 1000 plugins', () => {
            expect(() =>
                parseCommunityRegistry({
                    schemaVersion: 1,
                    plugins: Array.from(
                        { length: 1001 },
                        (_, index) => ({
                            ...validPlugin,
                            id: `community.plugin.${index}`,
                        }),
                    ),
                }),
            ).toThrow();
        });
    });
});