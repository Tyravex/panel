import {
  validateLanguagePluginTranslations,
  type LanguagePluginTranslations,
} from './language-plugin-translations';

/** Each multi-file resource is a complete top-level section, e.g. { dashboard: {...} }. */
export const mergeLanguageTranslationFiles = (
  resources: unknown[],
): LanguagePluginTranslations => {
  const merged: LanguagePluginTranslations = Object.create(null) as LanguagePluginTranslations;
  for (const resource of resources) {
    if (!validateLanguagePluginTranslations(resource)) {
      throw new Error('Invalid language plugin translations.');
    }
    for (const [key, value] of Object.entries(resource)) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) {
        throw new Error(`Duplicate language translation section: ${key}`);
      }
      merged[key] = value;
    }
  }
  // Validate aggregate limits, not just individual files.
  if (!validateLanguagePluginTranslations(merged)) {
    throw new Error('Invalid combined language plugin translations.');
  }
  return merged;
};
