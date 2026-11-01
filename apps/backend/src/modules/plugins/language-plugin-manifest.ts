export interface LanguagePluginManifest {
  schemaVersion: 1;
  id: string;
  type: 'language';
  version: string;
  language: { code: string; name: string; nativeName: string };
  translations:
  | { namespace: 'translation'; path: string; files?: never }
  | { namespace: 'translation'; files: string[]; path?: never };
}

const LANGUAGE_CODE_PATTERN = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const BUILT_IN_LANGUAGES = new Set(['en', 'pl']);
const MAX_MANIFEST_STRING_LENGTH = 200;
const MAX_TRANSLATION_FILES = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 &&
  value.length <= MAX_MANIFEST_STRING_LENGTH;

const isSafeTranslationPath = (value: unknown): value is string => {
  if (!isNonEmptyString(value) || !value.startsWith('./') ||
    !value.endsWith('.json') || value.includes('..') ||
    value.includes('\\') || value.includes('?') ||
    value.includes('#') || value.includes('\0') ||
    value.includes('//')) return false;
  const segments = value.slice(2).split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
};

export const getLanguageTranslationPaths = (manifest: LanguagePluginManifest): string[] =>
  manifest.translations.files ?? [manifest.translations.path!];

export const validateLanguagePluginManifest = (
  value: unknown,
): value is LanguagePluginManifest => {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.type !== 'language' ||
    !isNonEmptyString(value.id) || !PLUGIN_ID_PATTERN.test(value.id) ||
    !isNonEmptyString(value.version) || !VERSION_PATTERN.test(value.version) ||
    !isRecord(value.language)) return false;

  const { code, name, nativeName } = value.language;
  if (!isNonEmptyString(code) || code.length > 35 ||
    !LANGUAGE_CODE_PATTERN.test(code) || BUILT_IN_LANGUAGES.has(code.toLowerCase()) ||
    !isNonEmptyString(name) || !isNonEmptyString(nativeName)) return false;

  if (!isRecord(value.translations) || value.translations.namespace !== 'translation')
    return false;

  const { path, files } = value.translations;
  if ((path === undefined) === (files === undefined)) return false;
  if (path !== undefined) return isSafeTranslationPath(path);
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_TRANSLATION_FILES ||
    !files.every(isSafeTranslationPath)) return false;
  const unique = new Set(files.map((file: string) => file.normalize('NFC').toLowerCase()));
  return unique.size === files.length;
};
