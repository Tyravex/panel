import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en/common.json';
import pl from './locales/pl/common.json';
import de from './locales/de/common.json';

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
    de: { translation: de },
  },

  // Start with the guaranteed fallback language.
  // The application will restore the preferred language
  // after checking its availability with the backend.
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