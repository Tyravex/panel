import i18n from '@/shared/i18n';

import type { Language } from '@/features/auth/api/getLanguages';
import {
  getLanguageOptions,
  type LanguageOption,
} from '@/features/auth/api/getLanguageOptions';

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

const fallbackOption: LanguageOption = {
  ...fallbackLanguage,
  enabled: true,
};

const BUILT_IN_LANGUAGES = new Set(['en', 'pl']);

type LanguageSnapshot = {
  languages: Language[];
  options: LanguageOption[];
};

const registeredPluginLanguages = new Set<string>();
let pendingRefresh: Promise<LanguageSnapshot> | null = null;

export const hasLanguageResources = (code: string): boolean =>
  i18n.hasResourceBundle(code, 'translation');

const fallbackSnapshot = (): LanguageSnapshot => ({
  languages: [fallbackLanguage],
  options: [fallbackOption],
});

const removeUnavailableResources = (enabledCodes: Set<string>): void => {
  for (const code of registeredPluginLanguages) {
    if (!enabledCodes.has(code)) {
      unregisterPluginTranslations(code);
      registeredPluginLanguages.delete(code);
    }
  }
};

const refreshSnapshot = async (): Promise<LanguageSnapshot> => {
  try {
    const initialOptions = await getLanguageOptions();
    const initialEnabledCodes = new Set(
      initialOptions.filter((option) => option.enabled).map((option) => option.code),
    );

    // Stop using previously registered resources for disabled plugins immediately.
    removeUnavailableResources(initialEnabledCodes);

    const candidates = initialOptions.filter(
      (option) =>
        option.enabled &&
        isValidLanguageCode(option.code) &&
        !BUILT_IN_LANGUAGES.has(option.code.toLowerCase()) &&
        !registeredPluginLanguages.has(option.code),
    );

    // Fetch translations into memory first. Do not register them yet.
    const translations = await Promise.all(
      candidates.map(async (option) => {
        try {
          return await getPluginTranslations(option.code);
        } catch (error) {
          console.error(`Failed to load language plugin "${option.code}":`, error);
          return null;
        }
      }),
    );

    // Recheck plugin status AFTER translations finish. This closes the race where
    // a plugin is disabled while its translations are in flight.
    const latestOptions = await getLanguageOptions();
    const enabledCodes = new Set(
      latestOptions.filter((option) => option.enabled).map((option) => option.code),
    );
    removeUnavailableResources(enabledCodes);

    candidates.forEach((option, index) => {
      if (!enabledCodes.has(option.code) || translations[index] === null) {
        return;
      }
      try {
        if (!hasLanguageResources(option.code)) {
          registerPluginTranslations(option.code, translations[index]!);
        }
        registeredPluginLanguages.add(option.code);
      } catch (error) {
        console.error(`Failed to register language plugin "${option.code}":`, error);
      }
    });

    const options: LanguageOption[] = latestOptions
      .filter(
        (option) =>
          isValidLanguageCode(option.code) &&
          typeof option.name === 'string' &&
          typeof option.enabled === 'boolean',
      )
      .map((option) => ({
        ...option,
        enabled:
          option.enabled &&
          hasLanguageResources(option.code) &&
          (BUILT_IN_LANGUAGES.has(option.code.toLowerCase()) ||
            registeredPluginLanguages.has(option.code)),
      }));

    if (!options.some((option) => option.code === 'en')) {
      options.unshift(fallbackOption);
    }

    return {
      options,
      languages: options
        .filter((option) => option.enabled)
        .map(({ code, name }) => ({ code, name })),
    };
  } catch (error) {
    console.error('Failed to refresh available languages:', error);
    return fallbackSnapshot();
  }
};

const getSnapshot = (): Promise<LanguageSnapshot> => {
  if (pendingRefresh) return pendingRefresh;

  const refresh = refreshSnapshot();
  pendingRefresh = refresh;
  void refresh.then(
    () => {
      if (pendingRefresh === refresh) pendingRefresh = null;
    },
    () => {
      if (pendingRefresh === refresh) pendingRefresh = null;
    },
  );
  return refresh;
};

export const getAvailableLanguages = async (): Promise<Language[]> =>
  (await getSnapshot()).languages;

export const getAvailableLanguageOptions = async (): Promise<LanguageOption[]> =>
  (await getSnapshot()).options;

export const resolveActiveLanguage = (
  preferredLanguage: string,
  availableLanguages: Language[],
): string =>
  availableLanguages.some((language) => language.code === preferredLanguage)
    ? preferredLanguage
    : 'en';
