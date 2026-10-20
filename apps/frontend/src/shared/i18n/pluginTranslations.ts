import i18n from '@/shared/i18n';

export type PluginTranslations = Record<string, unknown>;

const BUILT_IN_LANGUAGES = new Set(['en', 'pl', 'de']);

const MAX_TRANSLATIONS_SIZE = 1024 * 1024;
const MAX_NESTING_DEPTH = 20;
const MAX_TRANSLATION_ENTRIES = 10000;
const MAX_TRANSLATION_LENGTH = 10000;

const BLOCKED_KEYS = new Set([
    '__proto__',
    'constructor',
    'prototype',
]);

const LANGUAGE_CODE_PATTERN =
    /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;

export const isValidLanguageCode = (code: string): boolean =>
    typeof code === 'string' &&
    code.length <= 35 &&
    LANGUAGE_CODE_PATTERN.test(code);

const isBuiltInLanguage = (code: string): boolean =>
    BUILT_IN_LANGUAGES.has(code.toLowerCase());

const isPlainObject = (
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
 * Validates translation resource structure and size limits.
 *
 * Translation values may be strings or nested objects.
 * Arrays, null, numbers, booleans and functions are rejected.
 */
export const validatePluginTranslations: (
    translations: unknown,
) => asserts translations is PluginTranslations = (
    translations,
) => {
    if (!isPlainObject(translations)) {
        throw new Error(
            'Plugin translations must be a plain JSON object.',
        );
    }

    let entryCount = 0;
    let totalSize = 0;

    const encoder = new TextEncoder();

    const validateObject = (
        object: Record<string, unknown>,
        depth: number,
    ): void => {
        if (depth > MAX_NESTING_DEPTH) {
            throw new Error(
                'Plugin translations exceed the maximum nesting depth.',
            );
        }

        for (const [key, value] of Object.entries(object)) {
            entryCount += 1;

            if (entryCount > MAX_TRANSLATION_ENTRIES) {
                throw new Error(
                    'Plugin translations contain too many entries.',
                );
            }

            if (!key || BLOCKED_KEYS.has(key)) {
                throw new Error('Invalid translation key.');
            }

            totalSize += encoder.encode(key).byteLength;

            if (typeof value === 'string') {
                if (value.length > MAX_TRANSLATION_LENGTH) {
                    throw new Error(
                        'A translation exceeds the maximum length.',
                    );
                }

                totalSize += encoder.encode(value).byteLength;
            } else if (isPlainObject(value)) {
                validateObject(value, depth + 1);
            } else {
                throw new Error(
                    'Translation values must be strings or nested objects.',
                );
            }

            if (totalSize > MAX_TRANSLATIONS_SIZE) {
                throw new Error(
                    'Plugin translations exceed the maximum size.',
                );
            }
        }
    };

    validateObject(translations, 1);
};

/**
 * Registers validated translation resources for a plugin language.
 *
 * Built-in languages cannot be overwritten by plugins.
 */
export const registerPluginTranslations = (
    languageCode: string,
    translations: unknown,
): void => {
    if (!isValidLanguageCode(languageCode)) {
        throw new Error('Invalid plugin language code.');
    }

    if (isBuiltInLanguage(languageCode)) {
        throw new Error(
            'Plugin translations cannot overwrite built-in languages.',
        );
    }

    validatePluginTranslations(translations);

    if (i18n.hasResourceBundle(languageCode, 'translation')) {
        throw new Error(
            `Translations for "${languageCode}" are already registered.`,
        );
    }

    i18n.addResourceBundle(
        languageCode,
        'translation',
        translations,
        false,
        false,
    );
};

/**
 * Removes resources for an unloaded plugin language.
 * Built-in languages are never removed.
 */
export const unregisterPluginTranslations = (
    languageCode: string,
): void => {
    if (!isValidLanguageCode(languageCode)) {
        return;
    }

    if (isBuiltInLanguage(languageCode)) {
        return;
    }

    if (i18n.hasResourceBundle(languageCode, 'translation')) {
        i18n.removeResourceBundle(languageCode, 'translation');
    }
};