import { TextDecoder } from 'node:util';

import { readPluginFile } from './plugin-file-reader';

const MAX_PLUGIN_JSON_BYTES = 1024 * 1024;

const utf8Decoder = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
});

/**
 * Reads and parses a JSON resource from plugin storage.
 *
 * Rejects oversized files, invalid UTF-8 and invalid JSON.
 * The parsed structure must be validated separately
 * against the expected manifest or translation schema.
 */
export const readPluginJson = async (
    relativePath: string,
): Promise<unknown> => {
    const buffer = await readPluginFile(
        relativePath,
        MAX_PLUGIN_JSON_BYTES,
    );

    let content: string;

    try {
        content = utf8Decoder.decode(buffer);
    } catch {
        throw new Error('Plugin JSON contains invalid UTF-8.');
    }

    try {
        return JSON.parse(content) as unknown;
    } catch {
        throw new Error('Plugin resource contains invalid JSON.');
    }
};
