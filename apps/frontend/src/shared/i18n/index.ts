/// <reference types="vite/client" />

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enManifest from './locales/en/manifest.json';
import plManifest from './locales/pl/manifest.json';

type TranslationTree = Record<string, unknown>;

interface BuiltInLanguageManifest {
  schemaVersion: 1;
  code: string;
  name: string;
  nativeName: string;
  type: 'built-in';
  translations: {
    namespace: 'translation';
    files: string[];
  };
}

const translationFiles = import.meta.glob<TranslationTree>(
  './locales/{en,pl}/*.json',
  {
    eager: true,
    import: 'default',
  },
);

const loadBuiltInTranslations = (
  manifest: BuiltInLanguageManifest,
): TranslationTree => {
  const translations: TranslationTree = {};

  for (const filename of manifest.translations.files) {
    if (
      !filename.endsWith('.json') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename === 'manifest.json' ||
      filename === 'common.legacy.json'
    ) {
      throw new Error(
        `Invalid translation file in ${manifest.code}: ${filename}`,
      );
    }

    const path = `./locales/${manifest.code}/${filename}`;
    const resource = translationFiles[path];

    if (!resource) {
      throw new Error(`Missing translation file: ${path}`);
    }

    const section = filename.slice(0, -'.json'.length);

    if (
      Object.keys(resource).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(resource, section)
    ) {
      throw new Error(
        `Invalid translation section structure: ${path}`,
      );
    }

    if (Object.prototype.hasOwnProperty.call(translations, section)) {
      throw new Error(
        `Duplicate translation section: ${manifest.code}/${section}`,
      );
    }

    translations[section] = resource[section];
  }

  return translations;
};

const en = loadBuiltInTranslations(
  enManifest as BuiltInLanguageManifest,
);

const pl = loadBuiltInTranslations(
  plManifest as BuiltInLanguageManifest,
);

export const LANGUAGE_STORAGE_KEY = 'tyravex.language';

export const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (
      saved &&
      saved.length <= 35 &&
      /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(saved)
    ) {
      return saved;
    }

    return 'en';
  } catch {
    return 'en';
  }
};

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },

  lng: 'en',
  fallbackLng: 'en',
  load: 'currentOnly',
  defaultNS: 'translation',

  returnNull: false,
  returnEmptyString: false,

  interpolation: {
    escapeValue: false,
  },

  react: {
    useSuspense: false,
  },
});

export default i18n;