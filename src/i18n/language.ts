import {
  getLocales,
} from 'expo-localization';

import {
  LanguageCode,
} from '../types';

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = [
  'uk',
  'ru',
  'en',
  'de',
];

const localeTags: Record<LanguageCode, string> = {
  uk: 'uk-UA',
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
};

export function normalizeLanguageCode(
  value?: string | null,
): LanguageCode {
  if (!value) {
    return 'en';
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0];

  if (
    SUPPORTED_LANGUAGES.includes(
      normalized as LanguageCode,
    )
  ) {
    return normalized as LanguageCode;
  }

  return 'en';
}

export function getDeviceLanguage(): LanguageCode {
  const primary = getLocales()[0];

  return normalizeLanguageCode(
    primary?.languageCode ??
      primary?.languageTag,
  );
}

export function getLocaleTag(
  language?: string | null,
): string {
  return localeTags[
    normalizeLanguageCode(language)
  ];
}