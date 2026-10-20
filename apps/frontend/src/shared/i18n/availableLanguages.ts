import i18n from '@/shared/i18n';

import {
  getLanguages,
  type Language,
} from '@/features/auth/api/getLanguages';

import { getPluginTranslations } from './getPluginTranslations';
import {
  isValidLanguageCode,
  registerPluginTranslations,
  unregisterPluginTranslations,
} from './pluginTranslations';

export const fallbackLanguage: Language = {
  code: 'en',
  name: 'English',
};

const BUILT_IN_LANGUAGES = new Set(['en', 'pl', 'de']);

const pendingLanguageLoads = new Map<string, Promise<boolean>>();
const registeredPluginLanguages = new Set<string>();

let pendingLanguageRefresh: Promise<Language[]> | null = null;

export const hasLanguageResources = (
  languageCode: string,
): boolean =>
  i18n.hasResourceBundle(languageCode, 'translation');

/**
 * Loads plugin translations and shares concurrent requests
 * for the same language.
 */
const loadPluginLanguage = (
  languageCode: string,
): Promise<boolean> => {
  if (!isValidLanguageCode(languageCode)) {
    return Promise.resolve(false);
  }

  if (BUILT_IN_LANGUAGES.has(languageCode.toLowerCase())) {
    return Promise.resolve(hasLanguageResources(languageCode));
  }

  if (hasLanguageResources(languageCode)) {
    return Promise.resolve(true);
  }

  const pending = pendingLanguageLoads.get(languageCode);

  if (pending) {
    return pending;
  }

  const loadPromise = (async (): Promise<boolean> => {
    try {
      const translations = await getPluginTranslations(languageCode);

      if (!hasLanguageResources(languageCode)) {
        registerPluginTranslations(languageCode, translations);
      }

      registeredPluginLanguages.add(languageCode);

      return hasLanguageResources(languageCode);
    } catch (error) {
      console.error(
        `Failed to load language plugin "${languageCode}":`,
        error,
      );

      return false;
    }
  })();

  pendingLanguageLoads.set(languageCode, loadPromise);

  void loadPromise.then(
    () => {
      if (pendingLanguageLoads.get(languageCode) === loadPromise) {
        pendingLanguageLoads.delete(languageCode);
      }
    },
    () => {
      if (pendingLanguageLoads.get(languageCode) === loadPromise) {
        pendingLanguageLoads.delete(languageCode);
      }
    },
  );

  return loadPromise;
};

/**
 * Fetches enabled languages, loads plugin resources and removes
 * resources belonging to plugins that are no longer enabled.
 */
const refreshAvailableLanguages = async (): Promise<Language[]> => {
  try {
    const languages = await getLanguages();

    const enabledCodes = new Set(
      languages.map((language) => language.code),
    );

    for (const code of registeredPluginLanguages) {
      if (!enabledCodes.has(code)) {
        unregisterPluginTranslations(code);
        registeredPluginLanguages.delete(code);
      }
    }

    const pluginLanguages = languages.filter(
      (language) =>
        !BUILT_IN_LANGUAGES.has(language.code.toLowerCase()),
    );

    await Promise.all(
      pluginLanguages.map((language) =>
        loadPluginLanguage(language.code),
      ),
    );

    const supported = languages.filter((language) => {
      if (!hasLanguageResources(language.code)) {
        return false;
      }

      return (
        BUILT_IN_LANGUAGES.has(language.code.toLowerCase()) ||
        registeredPluginLanguages.has(language.code)
      );
    });

    return supported.some((language) => language.code === 'en')
      ? supported
      : [fallbackLanguage, ...supported];
  } catch (error) {
    console.error('Failed to refresh available languages:', error);

    // Preserve previously loaded resources on backend failure.
    return [fallbackLanguage];
  }
};

/**
 * Returns enabled languages with available translation resources.
 * Concurrent callers share the same refresh operation.
 */
export const getAvailableLanguages = (): Promise<Language[]> => {
  if (pendingLanguageRefresh) {
    return pendingLanguageRefresh;
  }

  const refreshPromise = refreshAvailableLanguages();

  pendingLanguageRefresh = refreshPromise;

  void refreshPromise.then(
    () => {
      if (pendingLanguageRefresh === refreshPromise) {
        pendingLanguageRefresh = null;
      }
    },
    () => {
      if (pendingLanguageRefresh === refreshPromise) {
        pendingLanguageRefresh = null;
      }
    },
  );

  return refreshPromise;
};

/**
 * Resolves the active language without overwriting the preference.
 */
export const resolveActiveLanguage = (
  preferredLanguage: string,
  availableLanguages: Language[],
): string =>
  availableLanguages.some(
    (language) => language.code === preferredLanguage,
  )
    ? preferredLanguage
    : 'en';
