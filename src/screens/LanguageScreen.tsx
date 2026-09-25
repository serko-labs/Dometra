import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Card, Header, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';
import { LanguageCode } from '../types';

const languages: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', label: 'Русский', flag: '🇺🇦' },
];

export function LanguageScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state, changeLanguage } = useApp();
  return (
    <Screen>
      <Header title={t('language')} />
      {languages.map((language) => (
        <Pressable key={language.code} onPress={() => void changeLanguage(language.code).then(() => navigation.goBack())}>
          <Card>
            <View style={styles.row}>
              <Text style={styles.flag}>{language.flag}</Text>
              <Text style={styles.label}>{language.label}</Text>
              <Text style={styles.check}>{state.settings.language === language.code ? '✓' : ''}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flag: { fontSize: 25 },
  label: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  check: { color: colors.primary, fontSize: 20, fontWeight: '900' },
});
