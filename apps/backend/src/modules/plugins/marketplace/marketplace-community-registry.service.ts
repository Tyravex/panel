import {
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';

import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import type { LookupFunction } from 'node:net';

import type { MarketplaceRegistry } from '@shared/types';

import {
    isPublicRegistryIp,
    isSafeCommunityHttpsUrl,
    parseCommunityRegistry,
} from './marketplace-community-registry.validation';

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 8000;

@Injectable()
export class MarketplaceCommunityRegistryService {
    async getRegistry(
        registryUrl: string,
    ): Promise<MarketplaceRegistry> {
        const controller = new AbortController();

        const timer = setTimeout(() => {
            controller.abort();
        }, TIMEOUT_MS);

        try {
            if (!isSafeCommunityHttpsUrl(registryUrl)) {
                throw new Error('Invalid registry URL');
            }

            const url = new URL(registryUrl);

            const addresses = await Promise.race([
                lookup(url.hostname, {
                    all: true,
                    verbatim: true,
                }),
                new Promise<never>((_, reject) => {
                    controller.signal.addEventListener(
                        'abort',
                        () => reject(new Error('Registry timeout')),
                        { once: true },
                    );
                }),
            ]);

            if (controller.signal.aborted) {
                throw new Error('Registry timeout');
            }

            if (
                addresses.length === 0 ||
                addresses.some(
                    (entry) => !isPublicRegistryIp(entry.address),
                )
            ) {
                throw new Error('Unsafe registry address');
            }

            const address = addresses[0].address;

            const lookupPinned: LookupFunction = (
                _hostname,
                options,
                callback,
            ) => {
                if (
                    typeof options === 'object' &&
                    options !== null &&
                    options.all
                ) {
                    callback(null, [
                        {
                            address,
                            family: 4,
                        },
                    ]);
                    return;
                }

                callback(null, address, 4);
            };

            const body = await new Promise<string>(
                (resolve, reject) => {
                    if (controller.signal.aborted) {
                        reject(new Error('Registry timeout'));
                        return;
                    }

                    const req = request(
                        url,
                        {
                            method: 'GET',
                            lookup: lookupPinned,
                            signal: controller.signal,
                            agent: false,
                            headers: {
                                Accept: 'application/json',
                                'Accept-Encoding': 'identity',
                            },
                        },
                        (response) => {
                            // No redirects: only HTTP 200 is accepted.
                            if (response.statusCode !== 200) {
                                response.destroy();
                                reject(new Error('Registry HTTP error'));
                                return;
                            }

                            const contentEncoding =
                                response.headers['content-encoding'];

                            if (
                                contentEncoding &&
                                contentEncoding !== 'identity'
                            ) {
                                response.destroy();
                                reject(new Error('Unsupported encoding'));
                                return;
                            }

                            const contentLength =
                                response.headers['content-length'];

                            if (contentLength !== undefined) {
                                const length = Number(contentLength);

                                if (
                                    !Number.isSafeInteger(length) ||
                                    length < 0 ||
                                    length > MAX_BYTES
                                ) {
                                    response.destroy();
                                    reject(new Error('Registry too large'));
                                    return;
                                }
                            }

                            const chunks: Buffer[] = [];
                            let size = 0;

                            response.on('data', (chunk: Buffer) => {
                                size += chunk.byteLength;

                                if (size > MAX_BYTES) {
                                    response.destroy();
                                    reject(new Error('Registry too large'));
                                    return;
                                }

                                chunks.push(chunk);
                            });

                            response.on('end', () => {
                                resolve(
                                    Buffer.concat(chunks, size).toString('utf8'),
                                );
                            });

                            response.on('error', reject);
                            response.on('aborted', () => {
                                reject(new Error('Incomplete registry response'));
                            });
                        },
                    );

                    req.on('error', reject);
                    req.end();
                },
            );

            if (controller.signal.aborted) {
                throw new Error('Registry timeout');
            }

            const parsed: unknown = JSON.parse(body);

            return parseCommunityRegistry(parsed);
        } catch {
            throw new ServiceUnavailableException(
                'Community plugin registry is unavailable or invalid.',
            );
        } finally {
            clearTimeout(timer);
        }
    }
}