import React from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Card, Header, PrimaryButton, Screen, SecondaryButton, SectionTitle, TextButton } from '../components/ui';
import { useApp } from '../context/AppContext';
import { scheduleTestReminder } from '../services/notifications';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state, setMode, logout, setPushEnabled, resetDemo, supabaseConfigured } = useApp();

  const testNotification = async () => {
    const ok = await scheduleTestReminder();
    Alert.alert('Dometra', ok ? 'Notification scheduled in 3 seconds.' : 'Notification permission denied.');
  };

  return (
    <Screen>
      <Header title={t('settings')} subtitle={state.userEmail} />
      <SectionTitle title={t('roleMode')} />
      <Card>
        <View style={styles.segment}>
          <SecondaryButton title={`${state.settings.activeMode === 'LANDLORD' ? '✓ ' : ''}${t('landlord')}`} onPress={() => setMode('LANDLORD')} />
          <SecondaryButton title={`${state.settings.activeMode === 'TENANT' ? '✓ ' : ''}${t('tenant')}`} onPress={() => setMode('TENANT')} />
        </View>
      </Card>

      <SectionTitle title={t('language')} />
      <Card>
        <View style={styles.rowBetween}>
          <View><Text style={styles.title}>{t('language')}</Text><Text style={styles.muted}>{state.settings.language.toUpperCase()} • {state.settings.region}</Text></View>
          <TextButton title={t('language')} onPress={() => navigation.navigate('Language')} />
        </View>
      </Card>

      <SectionTitle title={t('notifications')} />
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}><Text style={styles.title}>Push</Text><Text style={styles.muted}>Rent, meter readings and overdue reminders</Text></View>
          <Switch value={state.settings.pushEnabled} onValueChange={setPushEnabled} />
        </View>
        <View style={styles.gapTop}><SecondaryButton title={t('pushTest')} onPress={() => void testNotification()} /></View>
      </Card>

      <SectionTitle title="Environment" />
      <Card>
        <Text style={styles.title}>{supabaseConfigured ? t('supabaseConnected') : t('supabaseNotConnected')}</Text>
        <Text style={styles.muted}>{supabaseConfigured ? 'Auth uses Supabase. Demo data remains available locally.' : 'Copy .env.example to .env to connect Supabase.'}</Text>
      </Card>

      <SecondaryButton title={t('resetDemo')} onPress={resetDemo} />
      <PrimaryButton title={t('logout')} onPress={() => void logout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 17 },
  gapTop: { marginTop: spacing.md },
});
