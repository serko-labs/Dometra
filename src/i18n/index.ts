import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { resources } from './resources';

const deviceLanguage = getLocales()[0]?.languageCode;
const supported = ['uk', 'en', 'de', 'ru'];
const initialLanguage = deviceLanguage && supported.includes(deviceLanguage) ? deviceLanguage : 'uk';

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
