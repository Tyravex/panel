import { ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import { request } from 'node:https';

import { MarketplaceCommunityRegistryService } from '../marketplace-community-registry.service';

jest.mock('node:dns/promises', () => ({
    lookup: jest.fn(),
}));

jest.mock('node:https', () => ({
    request: jest.fn(),
}));

type DnsAddress = {
    address: string;
    family: number;
};

const mockLookup = lookup as unknown as jest.Mock<
    Promise<DnsAddress[]>,
    [string, { all: true; verbatim: true }]
>;

const mockRequest = jest.mocked(request);

const REGISTRY_URL =
    'https://plugins.example.org/registry.json';

const VALID_PLUGIN = {
    id: 'community.example',
    name: 'Community Example',
    description: 'Example community plugin',
    type: 'extension',
    version: '1.0.0',
    downloadUrl: 'https://downloads.example.org/plugin.zip',
    sha256: 'a'.repeat(64),
};

const VALID_REGISTRY = {
    schemaVersion: 1,
    plugins: [VALID_PLUGIN],
};

type ResponseHeaders = Record<
    string,
    string | string[] | undefined
>;

type MockResponse = EventEmitter & {
    statusCode: number;
    headers: ResponseHeaders;
    destroy: jest.Mock;
};

type MockRequest = EventEmitter & {
    end: jest.Mock;
    destroy: jest.Mock;
};

function createResponse(
    statusCode = 200,
    headers: ResponseHeaders = {},
): MockResponse {
    const response = new EventEmitter() as MockResponse;

    response.statusCode = statusCode;
    response.headers = headers;
    response.destroy = jest.fn();

    return response;
}

function createRequest(): MockRequest {
    const req = new EventEmitter() as MockRequest;

    req.end = jest.fn();
    req.destroy = jest.fn();

    return req;
}

function mockHttpResponse(
    options: {
        statusCode?: number;
        headers?: ResponseHeaders;
        body?: string;
    } = {},
): MockRequest {
    const req = createRequest();

    mockRequest.mockImplementation(
        ((
            _url: unknown,
            _options: unknown,
            callback?: (response: MockResponse) => void,
        ) => {
            const response = createResponse(
                options.statusCode ?? 200,
                options.headers ?? {},
            );

            req.end.mockImplementation(() => {
                process.nextTick(() => {
                    if (!callback) {
                        req.emit(
                            'error',
                            new Error('Missing HTTP callback'),
                        );
                        return;
                    }

                    callback(response);

                    if (options.body !== undefined) {
                        response.emit(
                            'data',
                            Buffer.from(options.body),
                        );
                    }

                    response.emit('end');
                });
            });

            return req;
        }) as unknown as typeof request,
    );

    return req;
}
describe('MarketplaceCommunityRegistryService', () => {
    let service: MarketplaceCommunityRegistryService;

    beforeEach(() => {
        jest.clearAllMocks();

        service = new MarketplaceCommunityRegistryService();

        mockLookup.mockResolvedValue([
            {
                address: '8.8.8.8',
                family: 4,
            },
        ]);
    });

    it('returns a valid community registry', async () => {
        mockHttpResponse({
            body: JSON.stringify(VALID_REGISTRY),
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).resolves.toEqual(VALID_REGISTRY);

        expect(mockLookup).toHaveBeenCalledWith(
            'plugins.example.org',
            {
                all: true,
                verbatim: true,
            },
        );

        expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('rejects an unsafe registry URL before DNS', async () => {
        await expect(
            service.getRegistry(
                'http://localhost/registry.json',
            ),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );

        expect(mockLookup).not.toHaveBeenCalled();
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('rejects private DNS addresses', async () => {
        mockLookup.mockResolvedValue([
            {
                address: '192.168.1.10',
                family: 4,
            },
        ]);

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );

        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('rejects mixed public and private DNS addresses', async () => {
        mockLookup.mockResolvedValue([
            {
                address: '8.8.8.8',
                family: 4,
            },
            {
                address: '127.0.0.1',
                family: 4,
            },
        ]);

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );

        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('rejects empty DNS results', async () => {
        mockLookup.mockResolvedValue([]);

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );

        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('rejects DNS errors', async () => {
        mockLookup.mockRejectedValue(
            new Error('ENOTFOUND'),
        );

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );

        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('rejects HTTP redirects', async () => {
        mockHttpResponse({
            statusCode: 302,
            headers: {
                location: 'https://other.example.org/',
            },
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );

        expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('rejects HTTP 500', async () => {
        mockHttpResponse({
            statusCode: 500,
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('rejects a large Content-Length', async () => {
        mockHttpResponse({
            headers: {
                'content-length': String(
                    1024 * 1024 + 1,
                ),
            },
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('rejects an oversized streamed body', async () => {
        mockHttpResponse({
            body: 'x'.repeat(1024 * 1024 + 1),
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('rejects compressed responses', async () => {
        mockHttpResponse({
            headers: {
                'content-encoding': 'gzip',
            },
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('rejects malformed JSON', async () => {
        mockHttpResponse({
            body: '{ invalid json',
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('rejects duplicate plugin IDs', async () => {
        mockHttpResponse({
            body: JSON.stringify({
                schemaVersion: 1,
                plugins: [
                    VALID_PLUGIN,
                    VALID_PLUGIN,
                ],
            }),
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('rejects an invalid plugin checksum', async () => {
        mockHttpResponse({
            body: JSON.stringify({
                schemaVersion: 1,
                plugins: [
                    {
                        ...VALID_PLUGIN,
                        sha256: 'invalid',
                    },
                ],
            }),
        });

        await expect(
            service.getRegistry(REGISTRY_URL),
        ).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });

    it('uses a pinned IP lookup for HTTPS', async () => {
        mockHttpResponse({
            body: JSON.stringify(VALID_REGISTRY),
        });

        await service.getRegistry(REGISTRY_URL);

        const options = mockRequest.mock.calls[0][1];

        expect(options).toEqual(
            expect.objectContaining({
                method: 'GET',
                agent: false,
                lookup: expect.any(Function),
                signal: expect.any(AbortSignal),
            }),
        );
    });

    it('pins the verified IPv4 address for HTTPS', async () => {
        mockHttpResponse({
            body: JSON.stringify(VALID_REGISTRY),
        });

        await service.getRegistry(REGISTRY_URL);

        const options = mockRequest.mock.calls[0][1];

        if (
            typeof options !== 'object' ||
            options === null ||
            !('lookup' in options) ||
            typeof options.lookup !== 'function'
        ) {
            throw new Error('Missing pinned DNS lookup');
        }

        const pinnedLookup = options.lookup as LookupFunction;

        const result = await new Promise<{
            address: string;
            family: number;
        }>((resolve, reject) => {
            pinnedLookup(
                'plugins.example.org',
                { family: 4, all: false },
                (error, address, family) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    if (typeof address !== 'string') {
                        reject(new Error('Expected a single IPv4 address'));
                        return;
                    }

                    if (family !== 4) {
                        reject(new Error('Expected IPv4 address family'));
                        return;
                    }

                    resolve({
                        address,
                        family,
                    });
                },
            );
        });

        expect(result).toEqual({
            address: '8.8.8.8',
            family: 4,
        });
    });

    it('times out when DNS lookup never resolves', async () => {
        jest.useFakeTimers();

        try {
            mockLookup.mockImplementation(
                () => new Promise(() => { }),
            );

            const pending = service.getRegistry(REGISTRY_URL);

            const assertion = expect(
                pending,
            ).rejects.toBeInstanceOf(
                ServiceUnavailableException,
            );

            await jest.advanceTimersByTimeAsync(8001);

            await assertion;

            expect(mockRequest).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
});