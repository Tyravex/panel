import { registerPluginTranslations } from './pluginTranslations';

export interface LanguagePluginManifest {
  schemaVersion: 1;
  id: string;
  type: 'language';
  version: string;

  language: {
    code: string;
    name: string;
    nativeName: string;
  };

  translations: {
    namespace: 'translation';
    path: string;
  };
}

const LANGUAGE_CODE_PATTERN =
  /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;

const PLUGIN_ID_PATTERN =
  /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

const VERSION_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const MAX_MANIFEST_STRING_LENGTH = 200;

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const isNonEmptyString = (
  value: unknown,
): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= MAX_MANIFEST_STRING_LENGTH;

/**
 * Validates the basic structure of a language plugin manifest.
 *
 * This does not verify the plugin's origin or authenticity.
 */
export const validateLanguagePluginManifest = (
  value: unknown,
): value is LanguagePluginManifest => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.schemaVersion !== 1 ||
    value.type !== 'language' ||
    !isNonEmptyString(value.id) ||
    !PLUGIN_ID_PATTERN.test(value.id) ||
    !isNonEmptyString(value.version) ||
    !VERSION_PATTERN.test(value.version)
  ) {
    return false;
  }

  if (!isRecord(value.language)) {
    return false;
  }

  const { code, name, nativeName } = value.language;

  if (
    !isNonEmptyString(code) ||
    code.length > 35 ||
    !LANGUAGE_CODE_PATTERN.test(code) ||
    !isNonEmptyString(name) ||
    !isNonEmptyString(nativeName)
  ) {
    return false;
  }

  if (!isRecord(value.translations)) {
    return false;
  }

  const { namespace, path } = value.translations;

  if (
    namespace !== 'translation' ||
    !isNonEmptyString(path) ||
    !path.startsWith('./') ||
    path.includes('..') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#')
  ) {
    return false;
  }

  return true;
};

/**
 * Registers a language plugin using its manifest
 * and already-loaded translation resources.
 *
 * The manifest and translations are validated before
 * the resources are registered in i18next.
 *
 * This function does not download files or execute plugin code.
 */
export const registerLanguagePlugin = (
  manifest: unknown,
  translations: unknown,
): void => {
  if (!validateLanguagePluginManifest(manifest)) {
    throw new Error('Invalid language plugin manifest.');
  }

  registerPluginTranslations(
    manifest.language.code,
    translations,
  );
};
