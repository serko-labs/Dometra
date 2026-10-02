import React from 'react';

import {
  Alert,
  StyleSheet,
  Switch,
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
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  TextButton,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  scheduleTestReminder,
} from '../services/notifications';

import {
  colors,
  spacing,
} from '../theme';

import {
  LanguageCode,
} from '../types';

const languageLabels:
  Record<
    LanguageCode,
    string
  > = {
  uk:
    'Українська',

  ru:
    'Русский',

  en:
    'English',

  de:
    'Deutsch',
};

export function SettingsScreen() {
  const {
    t,
  } =
    useTranslation();

  const navigation =
    useNavigation<any>();

  const {
    state,
    session,
    setMode,
    logout,
    setPushEnabled,
  } =
    useApp();

  const testNotification =
    async () => {
      try {
        const ok =
          await scheduleTestReminder();

        Alert.alert(
          'Dometra',
          ok
            ? t(
                'notificationScheduled',
              )
            : t(
                'notificationPermissionDenied',
              ),
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Dometra',
          error instanceof Error
            ? error.message
            : t(
                'notificationPermissionDenied',
              ),
        );
      }
    };

  return (
    <Screen>
      <Header
        title={
          t(
            'settings',
          )
        }
        subtitle={
          session?.user
            .email ??
          ''
        }
      />

      <SectionTitle
        title={
          t(
            'roleMode',
          )
        }
      />

      <Card>
        <View
          style={
            styles.segment
          }
        >
          <SecondaryButton
            title={`${state.settings.activeMode === 'LANDLORD' ? '✓ ' : ''}${t('landlord')}`}
            onPress={() =>
              void setMode(
                'LANDLORD',
              )
            }
          />

          <SecondaryButton
            title={`${state.settings.activeMode === 'TENANT' ? '✓ ' : ''}${t('tenant')}`}
            onPress={() =>
              void setMode(
                'TENANT',
              )
            }
          />
        </View>
      </Card>

      <SectionTitle
        title={
          t(
            'language',
          )
        }
      />

      <Card>
        <View
          style={
            styles.rowBetween
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.title
              }
            >
              {t(
                'language',
              )}
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              {
                languageLabels[
                  state.settings
                    .language
                ]
              }
              {' • '}
              {state.settings.region}
            </Text>
          </View>

          <TextButton
            title={
              t(
                'change',
              )
            }
            onPress={() =>
              navigation.navigate(
                'Language',
              )
            }
          />
        </View>
      </Card>

      <SectionTitle
        title={
          t(
            'notifications',
          )
        }
      />

      <Card>
        <View
          style={
            styles.rowBetween
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.title
              }
            >
              {t(
                'push',
              )}
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              {t(
                'notificationDescription',
              )}
            </Text>
          </View>

          <Switch
            value={
              state.settings
                .pushEnabled
            }
            onValueChange={
              value =>
                void setPushEnabled(
                  value,
                )
            }
          />
        </View>

        <View
          style={
            styles.gapTop
          }
        >
          <SecondaryButton
            title={
              t(
                'pushTest',
              )
            }
            onPress={() =>
              void testNotification()
            }
          />
        </View>
      </Card>

      <SectionTitle
        title={
          t(
            'account',
          )
        }
      />

      <Card>
        <Text
          style={
            styles.title
          }
        >
          {session?.user
            .email}
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          {t(
            'signedInWithSupabase',
          )}
        </Text>
      </Card>

      <PrimaryButton
        title={
          t(
            'logout',
          )
        }
        onPress={() =>
          void logout()
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    segment: {
      flexDirection:
        'row',

      gap:
        spacing.sm,
    },

    rowBetween: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    flex: {
      flex:
        1,
    },

    title: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        5,

      lineHeight:
        17,
    },

    gapTop: {
      marginTop:
        spacing.md,
    },
  });