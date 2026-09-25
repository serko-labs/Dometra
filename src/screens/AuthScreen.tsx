import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Field, PrimaryButton, Screen, SecondaryButton, TextButton } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function AuthScreen() {
  const { t } = useTranslation();
  const { login, register, loginDemo, supabaseConfigured } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password);
    } catch (error) {
      Alert.alert('Auth', error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.brandWrap}>
        <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
        <Text style={styles.brand}>Dometra</Text>
        <Text style={styles.tagline}>Rental management, meters and payments in one app.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.switchRow}>
          <TextButton title={t('login')} onPress={() => setMode('login')} />
          <Text style={styles.dot}>•</Text>
          <TextButton title={t('register')} onPress={() => setMode('register')} />
        </View>
        <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry />
        <PrimaryButton title={mode === 'login' ? t('login') : t('register')} onPress={submit} disabled={busy || !email || password.length < 6} />
      </View>

      <View style={styles.demoBox}>
        <Text style={styles.demoTitle}>{t('demoMode')}</Text>
        <Text style={styles.demoText}>{t('authHint')}</Text>
        <SecondaryButton title={t('continueDemo')} onPress={loginDemo} />
        <Text style={styles.connection}>{supabaseConfigured ? `● ${t('supabaseConnected')}` : `○ ${t('supabaseNotConnected')}`}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center', paddingTop: 70 },
  brandWrap: { alignItems: 'center', gap: 8, marginBottom: 18 },
  logo: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 29 },
  brand: { fontSize: 34, fontWeight: '900', color: colors.text },
  tagline: { color: colors.muted, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  form: { gap: spacing.md },
  switchRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { color: colors.border },
  demoBox: { backgroundColor: colors.primarySoft, borderRadius: 16, padding: 16, gap: 10 },
  demoTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  demoText: { color: colors.muted, lineHeight: 19 },
  connection: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
