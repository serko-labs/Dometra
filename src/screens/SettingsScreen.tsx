import React, {
  useState,
} from 'react';

import {
  Alert,
  Pressable,
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
  Screen,
  SectionTitle,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  colors,
  spacing,
} from '../theme';

import {
  AppMode,
  LanguageCode,
} from '../types';

function languageName(
  language:
    LanguageCode,
) {
  switch (
    language
  ) {
    case 'uk':
      return 'Українська';

    case 'ru':
      return 'Русский';

    case 'de':
      return 'Deutsch';

    case 'en':
    default:
      return 'English';
  }
}

function ModeButton({
  title,
  selected,
  onPress,
}: {
  title:
    string;

  selected:
    boolean;

  onPress:
    () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.modeButton,

        selected &&
          styles.modeButtonSelected,

        pressed &&
          styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.modeButtonText,

          selected &&
            styles.modeButtonTextSelected,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation =
    useNavigation<any>();

  const {
    t,
  } =
    useTranslation();

  const {
    state,
    session,
    setMode,
    setPushEnabled,
    logout,
  } =
    useApp();

  const [
    pushSaving,
    setPushSaving,
  ] =
    useState(
      false,
    );

  const [
    modeSaving,
    setModeSaving,
  ] =
    useState(
      false,
    );

  const changeMode =
    async (
      mode:
        AppMode,
    ) => {
      if (
        mode ===
          state.settings
            .activeMode ||
        modeSaving
      ) {
        return;
      }

      setModeSaving(
        true,
      );

      try {
        await setMode(
          mode,
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Dometra',

          error instanceof
          Error
            ? error.message
            : 'Unable to change app mode.',
        );
      } finally {
        setModeSaving(
          false,
        );
      }
    };

  const changePush =
    async (
      enabled:
        boolean,
    ) => {
      if (
        pushSaving
      ) {
        return;
      }

      setPushSaving(
        true,
      );

      try {
        await setPushEnabled(
          enabled,
        );
      } catch (
        error
      ) {
        Alert.alert(
          t(
            'notifications',
            {
              defaultValue:
                'Notifications',
            },
          ),

          error instanceof
          Error
            ? error.message
            : 'Unable to update notification settings.',
        );
      } finally {
        setPushSaving(
          false,
        );
      }
    };

  const openLanguage =
    () => {
      navigation
        .getParent()
        ?.navigate(
          'Language',
        );
    };

  const confirmLogout =
    () => {
      Alert.alert(
        t(
          'signOut',
          {
            defaultValue:
              'Sign out',
          },
        ),

        t(
          'signOutConfirm',
          {
            defaultValue:
              'Are you sure you want to sign out?',
          },
        ),

        [
          {
            text:
              t(
                'cancel',
                {
                  defaultValue:
                    'Cancel',
                },
              ),

            style:
              'cancel',
          },

          {
            text:
              t(
                'signOut',
                {
                  defaultValue:
                    'Sign out',
                },
              ),

            style:
              'destructive',

            onPress:
              () => {
                void logout();
              },
          },
        ],
      );
    };

  return (
    <Screen>
      <Header
        title={t(
          'settings',
          {
            defaultValue:
              'Settings',
          },
        )}
        subtitle={
          session?.user.email ??
          undefined
        }
      />

      <SectionTitle
        title={t(
          'appMode',
          {
            defaultValue:
              'App mode',
          },
        )}
      />

      <Card>
        <Text
          style={
            styles.sectionDescription
          }
        >
          {t(
            'appModeDescription',
            {
              defaultValue:
                'Switch between landlord and tenant views.',
            },
          )}
        </Text>

        <View
          style={
            styles.modeRow
          }
        >
          <ModeButton
            title={t(
              'landlord',
              {
                defaultValue:
                  'Landlord',
              },
            )}
            selected={
              state.settings
                .activeMode ===
              'LANDLORD'
            }
            onPress={() =>
              void changeMode(
                'LANDLORD',
              )
            }
          />

          <ModeButton
            title={t(
              'tenant',
              {
                defaultValue:
                  'Tenant',
              },
            )}
            selected={
              state.settings
                .activeMode ===
              'TENANT'
            }
            onPress={() =>
              void changeMode(
                'TENANT',
              )
            }
          />
        </View>
      </Card>

      <SectionTitle
        title={t(
          'preferences',
          {
            defaultValue:
              'Preferences',
          },
        )}
      />

      <Card>
        <Pressable
          onPress={
            openLanguage
          }
          style={({
            pressed,
          }) => [
            styles.settingRow,

            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={
              styles.settingContent
            }
          >
            <Text
              style={
                styles.settingTitle
              }
            >
              {t(
                'language',
                {
                  defaultValue:
                    'Language',
                },
              )}
            </Text>

            <Text
              style={
                styles.settingSubtitle
              }
            >
              {languageName(
                state.settings
                  .language,
              )}
            </Text>
          </View>

          <Text
            style={
              styles.chevron
            }
          >
            ›
          </Text>
        </Pressable>
      </Card>

      <SectionTitle
        title={t(
          'notifications',
          {
            defaultValue:
              'Notifications',
          },
        )}
      />

      <Card>
        <View
          style={
            styles.settingRow
          }
        >
          <View
            style={
              styles.settingContent
            }
          >
            <Text
              style={
                styles.settingTitle
              }
            >
              {t(
                'pushNotifications',
                {
                  defaultValue:
                    'Push notifications',
                },
              )}
            </Text>

            <Text
              style={
                styles.settingSubtitle
              }
            >
              {t(
                'pushNotificationsDescription',
                {
                  defaultValue:
                    'Payment, meter reading, rent and tenancy updates.',
                },
              )}
            </Text>
          </View>

          <Switch
            value={
              state.settings
                .pushEnabled
            }
            disabled={
              pushSaving
            }
            onValueChange={
              enabled =>
                void changePush(
                  enabled,
                )
            }
          />
        </View>
      </Card>

      <SectionTitle
        title={t(
          'account',
          {
            defaultValue:
              'Account',
          },
        )}
      />

      <Card>
        <Pressable
          onPress={
            confirmLogout
          }
          style={({
            pressed,
          }) => [
            styles.logoutRow,

            pressed &&
              styles.pressed,
          ]}
        >
          <Text
            style={
              styles.logoutText
            }
          >
            {t(
              'signOut',
              {
                defaultValue:
                  'Sign out',
              },
            )}
          </Text>

          <Text
            style={
              styles.logoutChevron
            }
          >
            ›
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    sectionDescription: {
      color:
        colors.muted,

      fontSize:
        13,

      lineHeight:
        19,

      marginBottom:
        spacing.md,
    },

    modeRow: {
      flexDirection:
        'row',

      gap:
        spacing.sm,
    },

    modeButton: {
      flex:
        1,

      minHeight:
        46,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        12,

      paddingHorizontal:
        spacing.md,
    },

    modeButtonSelected: {
      borderColor:
        colors.primary,

      backgroundColor:
        `${colors.primary}12`,
    },

    modeButtonText: {
      color:
        colors.muted,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    modeButtonTextSelected: {
      color:
        colors.primary,

      fontWeight:
        '800',
    },

    settingRow: {
      minHeight:
        58,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    settingContent: {
      flex:
        1,
    },

    settingTitle: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '700',
    },

    settingSubtitle: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        3,
    },

    chevron: {
      color:
        colors.muted,

      fontSize:
        24,

      fontWeight:
        '400',
    },

    logoutRow: {
      minHeight:
        52,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    logoutText: {
      color:
        '#B42318',

      fontSize:
        15,

      fontWeight:
        '700',
    },

    logoutChevron: {
      color:
        '#B42318',

      fontSize:
        24,
    },

    pressed: {
      opacity:
        0.65,
    },
  });