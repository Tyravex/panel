import { api } from '@/shared/api/client';

import {
  isValidLanguageCode,
  validatePluginTranslations,
  type PluginTranslations,
} from './pluginTranslations';

/**
 * Downloads translations for an enabled language plugin
 * from the current Tyravex instance.
 *
 * The backend is responsible for checking plugin status,
 * manifest validity and access to installed files.
 */
export const getPluginTranslations = async (
  languageCode: string,
): Promise<PluginTranslations> => {
  if (!isValidLanguageCode(languageCode)) {
    throw new Error('Invalid language code.');
  }

  const response = await api.get<unknown>(
    `/languages/${encodeURIComponent(languageCode)}/translations`,
  );

  const translations = response.data;

  validatePluginTranslations(translations);

  return translations;
};
