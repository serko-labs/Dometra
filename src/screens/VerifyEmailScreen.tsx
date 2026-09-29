import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  Field,
  PrimaryButton,
  Screen,
  TextButton,
} from '../components/ui';
import { useApp } from '../context/AppContext';

export function VerifyEmailScreen() {
  const {
    pendingVerificationEmail,
    verifyEmailCode,
    resendVerificationCode,
  } = useApp();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    try {
      setBusy(true);
      await verifyEmailCode(code.trim());
    } catch (error) {
      Alert.alert(
        'Verification failed',
        error instanceof Error ? error.message : 'Invalid code'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify your email</Text>

        <Text style={styles.description}>
          We sent a verification code to
        </Text>

        <Text style={styles.email}>
          {pendingVerificationEmail}
        </Text>

        <Field
          label="Verification code"
          value={code}
          onChangeText={(value) =>
            setCode(value.replace(/\D/g, '').slice(0, 8))
          }
          keyboardType="number-pad"
          maxLength={8}
        />

        <PrimaryButton
          title="Confirm"
          onPress={confirm}
          disabled={busy || code.length !== 8}
        />

        <TextButton
          title="Resend code"
          onPress={resendVerificationCode}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },

  content: {
    gap: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
  },

  description: {
    fontSize: 15,
    opacity: 0.7,
  },

  email: {
    fontSize: 16,
    fontWeight: '700',
  },
});