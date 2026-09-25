import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { CurrencyCode } from '../types';

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.screenContent, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, style]}>{children}</View>
  );
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text style={styles.h1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.h2}>{title}</Text>
      {action}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.textButton}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneStyle = tone === 'success' ? styles.badgeSuccess : tone === 'warning' ? styles.badgeWarning : tone === 'danger' ? styles.badgeDanger : styles.badgeNeutral;
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Card>
  );
}

export function Money({ amount, currency, strong = false }: { amount: number; currency: CurrencyCode; strong?: boolean }) {
  const locale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'uk-UA';
  const text = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'UAH' ? 0 : 2 }).format(amount);
  return <Text style={strong ? styles.moneyStrong : styles.money}>{text}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function EmptyState({ title }: { title: string }) {
  return (
    <Card>
      <Text style={styles.empty}>— {title} —</Text>
    </Card>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screenContent: { padding: spacing.md, paddingBottom: 36, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 2 },
  h1: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 19, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  primaryButton: { backgroundColor: colors.primary, minHeight: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { backgroundColor: colors.primarySoft, minHeight: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  textButton: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  fieldWrap: { gap: 7 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, minHeight: 48, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeNeutral: { backgroundColor: '#EFF1F5' },
  badgeSuccess: { backgroundColor: colors.successSoft },
  badgeWarning: { backgroundColor: colors.warningSoft },
  badgeDanger: { backgroundColor: colors.dangerSoft },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  statCard: { width: '48%', minHeight: 112 },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  statValue: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 8 },
  statHint: { color: colors.muted, fontSize: 11, marginTop: 7 },
  money: { color: colors.text, fontSize: 15 },
  moneyStrong: { color: colors.text, fontSize: 18, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 12 },
});
