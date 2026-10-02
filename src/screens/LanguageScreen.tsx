import React, {
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useNavigation,
} from '@react-navigation/native';

import {
  useTranslation,
} from 'react-i18next';

import {
  Card,
  Header,
  Screen,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  colors,
  spacing,
} from '../theme';

import {
  LanguageCode,
} from '../types';

const languages: Array<{
  code: LanguageCode;
  label: string;
  flag: string;
}> = [
  {
    code:
      'uk',

    label:
      'Українська',

    flag:
      '🇺🇦',
  },
  {
    code:
      'ru',

    label:
      'Русский',

    flag:
      '🇷🇺',
  },
  {
    code:
      'en',

    label:
      'English',

    flag:
      '🇬🇧',
  },
  {
    code:
      'de',

    label:
      'Deutsch',

    flag:
      '🇩🇪',
  },
];

export function LanguageScreen() {
  const {
    t,
  } =
    useTranslation();

  const navigation =
    useNavigation<any>();

  const {
    state,
    changeLanguage,
  } =
    useApp();

  const [
    busyLanguage,
    setBusyLanguage,
  ] =
    useState<
      LanguageCode | null
    >(null);

  const selectLanguage =
    async (
      language:
        LanguageCode,
    ) => {
      if (
        busyLanguage
      ) {
        return;
      }

      setBusyLanguage(
        language,
      );

      try {
        await changeLanguage(
          language,
        );

        navigation.goBack();
      } catch (
        error
      ) {
        Alert.alert(
          'Dometra',
          error instanceof Error
            ? error.message
            : t(
                'languageChangeFailed',
              ),
        );
      } finally {
        setBusyLanguage(
          null,
        );
      }
    };

  return (
    <Screen>
      <Header
        title={
          t(
            'language',
          )
        }
        subtitle={
          t(
            'selectLanguage',
          )
        }
      />

      {languages.map(
        language => {
          const selected =
            state.settings.language ===
            language.code;

          const busy =
            busyLanguage ===
            language.code;

          return (
            <Pressable
              key={
                language.code
              }
              disabled={
                busyLanguage !==
                null
              }
              onPress={() =>
                void selectLanguage(
                  language.code,
                )
              }
            >
              <Card>
                <View
                  style={
                    styles.row
                  }
                >
                  <Text
                    style={
                      styles.flag
                    }
                  >
                    {
                      language.flag
                    }
                  </Text>

                  <View
                    style={
                      styles.flex
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {
                        language.label
                      }
                    </Text>

                    <Text
                      style={
                        styles.code
                      }
                    >
                      {language.code.toUpperCase()}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.check
                    }
                  >
                    {busy
                      ? '…'
                      : selected
                        ? '✓'
                        : ''}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        },
      )}
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    row: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    flex: {
      flex:
        1,
    },

    flag: {
      fontSize:
        25,
    },

    label: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '700',
    },

    code: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',

      marginTop:
        3,
    },

    check: {
      width:
        24,

      color:
        colors.primary,

      fontSize:
        20,

      fontWeight:
        '900',

      textAlign:
        'center',
    },
  });