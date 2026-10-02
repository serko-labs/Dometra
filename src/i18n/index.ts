import i18n from 'i18next';

import {
  initReactI18next,
} from 'react-i18next';

import {
  getDeviceLanguage,
  SUPPORTED_LANGUAGES,
} from './language';

import {
  resources,
} from './resources';

import {
  tenantFlowResources,
} from './tenantFlowResources';

const initialLanguage =
  getDeviceLanguage();

const mergedResources = {
  uk: {
    translation: {
      ...resources.uk.translation,
      ...tenantFlowResources.uk,
    },
  },

  ru: {
    translation: {
      ...resources.ru.translation,
      ...tenantFlowResources.ru,
    },
  },

  en: {
    translation: {
      ...resources.en.translation,
      ...tenantFlowResources.en,
    },
  },

  de: {
    translation: {
      ...resources.de.translation,
      ...tenantFlowResources.de,
    },
  },
};

void i18n
  .use(
    initReactI18next,
  )
  .init({
    resources:
      mergedResources,

    lng:
      initialLanguage,

    fallbackLng:
      'en',

    supportedLngs:
      [
        ...SUPPORTED_LANGUAGES,
      ],

    load:
      'languageOnly',

    interpolation: {
      escapeValue:
        false,
    },
  });

export default i18n;