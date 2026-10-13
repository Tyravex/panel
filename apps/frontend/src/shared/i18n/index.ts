import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en/common.json"
import pl from "./locales/pl/common.json"
import de from "./locales/de/common.json"

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
    de: { translation: de }
  },
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export default i18n