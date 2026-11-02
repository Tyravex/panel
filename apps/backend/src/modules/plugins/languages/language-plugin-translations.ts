export type LanguagePluginTranslations = Record<string, unknown>;

const MAX_NESTING_DEPTH = 20;
const MAX_TRANSLATION_ENTRIES = 10_000;
const MAX_TRANSLATION_LENGTH = 10_000;
const MAX_TRANSLATIONS_BYTES = 1024 * 1024;

const BLOCKED_KEYS = new Set([
    '__proto__',
    'constructor',
    'prototype',
]);

const isRecord = (
    value: unknown,
): value is Record<string, unknown> => {
    if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * Validates translation resources supplied by a language plugin.
 *
 * Only nested objects and string values are allowed.
 * Arrays, numbers, booleans and null are rejected.
 */
export const validateLanguagePluginTranslations = (
    value: unknown,
): value is LanguagePluginTranslations => {
    if (!isRecord(value)) {
        return false;
    }

    let entryCount = 0;
    let totalBytes = 0;

    const validateObject = (
        object: Record<string, unknown>,
        depth: number,
    ): boolean => {
        if (depth > MAX_NESTING_DEPTH) {
            return false;
        }

        for (const [key, entry] of Object.entries(object)) {
            if (
                !key ||
                BLOCKED_KEYS.has(key)
            ) {
                return false;
            }

            entryCount += 1;
            totalBytes += Buffer.byteLength(key, 'utf8');

            if (
                entryCount > MAX_TRANSLATION_ENTRIES ||
                totalBytes > MAX_TRANSLATIONS_BYTES
            ) {
                return false;
            }

            if (typeof entry === 'string') {
                if (entry.length > MAX_TRANSLATION_LENGTH) {
                    return false;
                }

                totalBytes += Buffer.byteLength(entry, 'utf8');

                if (totalBytes > MAX_TRANSLATIONS_BYTES) {
                    return false;
                }

                continue;
            }

            if (!isRecord(entry)) {
                return false;
            }

            if (!validateObject(entry, depth + 1)) {
                return false;
            }
        }

        return true;
    };

    return validateObject(value, 0);
};
