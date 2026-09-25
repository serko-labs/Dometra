import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { LanguageCode } from '../types';

const baseUrl = process.env.EXPO_PUBLIC_TRANSLATIONS_BASE_URL?.replace(/\/$/, '');

export async function syncRemoteTranslations(language: LanguageCode) {
  if (!baseUrl) return false;
  try {
    const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
    if (!manifestResponse.ok) return false;
    const manifest = (await manifestResponse.json()) as { version: number };
    const storageKey = `dometra.translation.version.${language}`;
    const localVersion = Number((await AsyncStorage.getItem(storageKey)) ?? 0);
    if (localVersion >= manifest.version) return false;

    const response = await fetch(`${baseUrl}/${language}.json`);
    if (!response.ok) return false;
    const bundle = (await response.json()) as Record<string, string>;
    i18n.addResourceBundle(language, 'translation', bundle, true, true);
    await AsyncStorage.setItem(storageKey, String(manifest.version));
    return true;
  } catch {
    return false;
  }
}
