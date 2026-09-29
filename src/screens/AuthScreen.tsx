import React, { useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from 'react-i18next';

import {
  Field,
  PrimaryButton,
  Screen,
  TextButton,
} from '../components/ui';

import { useApp } from '../context/AppContext';

import {
  colors,
  spacing,
} from '../theme';

export function AuthScreen() {
  const { t } = useTranslation();

  const {
    login,
    register,
  } = useApp();

  const [mode, setMode] = useState<
    'login' | 'register'
  >('login');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const submit = async () => {
    console.log(
      '[Dometra Auth] Submit pressed:',
      mode,
    );

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert(
        'Dometra',
        'Please enter your email.',
      );

      return;
    }

    if (!password) {
      Alert.alert(
        'Dometra',
        'Please enter your password.',
      );

      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Dometra',
        'Password must contain at least 6 characters.',
      );

      return;
    }

    setBusy(true);

    try {
      if (mode === 'login') {
        console.log(
          '[Dometra Auth] Starting login...',
        );

        await login(
          cleanEmail,
          password,
        );

        console.log(
          '[Dometra Auth] Login completed.',
        );
      } else {
        console.log(
          '[Dometra Auth] Starting registration...',
        );

        await register(
          cleanEmail,
          password,
        );

        console.log(
          '[Dometra Auth] Registration request completed.',
        );

        Alert.alert(
          'Check your email',
          `We sent a confirmation link to ${cleanEmail}.\n\nOpen the email and confirm your account. Dometra will sign you in after confirmation.`,
        );
      }
    } catch (error) {
      console.error(
        '[Dometra Auth] Authentication error:',
        error,
      );

      Alert.alert(
        mode === 'login'
          ? 'Login failed'
          : 'Registration failed',

        error instanceof Error
          ? error.message
          : 'Authentication failed.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.brandWrap}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>
            D
          </Text>
        </View>

        <Text style={styles.brand}>
          Dometra
        </Text>

        <Text style={styles.tagline}>
          Rental management,
          meters and payments
          in one app.
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.switchRow}>
          <TextButton
            title={t('login')}
            onPress={() =>
              setMode('login')
            }
          />

          <Text style={styles.dot}>
            •
          </Text>

          <TextButton
            title={t('register')}
            onPress={() =>
              setMode('register')
            }
          />
        </View>

        <Field
          label={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
        />

        <Field
          label={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onSubmitEditing={() => {
            void submit();
          }}
          returnKeyType="go"
        />

        <PrimaryButton
          title={
            busy
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
                ? t('login')
                : t('register')
          }
          onPress={() => {
            void submit();
          }}

          /*
           * IMPORTANT:
           *
           * Do NOT disable because of
           * email/password validation.
           *
           * Otherwise pressing the button
           * appears to do nothing.
           *
           * Validation happens inside
           * submit().
           */
          disabled={busy}
        />

        {mode === 'register' ? (
          <Text style={styles.hint}>
            We'll send a confirmation
            link to your email before
            activating the account.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      justifyContent: 'center',
      paddingTop: 70,
    },

    brandWrap: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 24,
    },

    logo: {
      width: 58,
      height: 58,
      borderRadius: 18,

      backgroundColor:
        colors.primary,

      alignItems: 'center',
      justifyContent: 'center',
    },

    logoText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 29,
    },

    brand: {
      fontSize: 34,
      fontWeight: '900',
      color: colors.text,
    },

    tagline: {
      color: colors.muted,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 20,
    },

    form: {
      gap: spacing.md,
    },

    switchRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    dot: {
      color: colors.border,
    },

    hint: {
      color: colors.muted,
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 18,
    },
  });