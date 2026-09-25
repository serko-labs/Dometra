import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, Money, PrimaryButton, Screen, SecondaryButton, SectionTitle, TextButton } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function TenantHomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state, setMode } = useApp();
  const property = state.properties.find((item) => item.tenantName);
  const latestInvoice = state.invoices.find((invoice) => invoice.propertyId === property?.id);
  const propertyMeters = state.meters.filter((meter) => meter.propertyId === property?.id);
  const incomplete = propertyMeters.some((meter) => meter.registers.some((register) => register.currentValue === undefined));

  if (!property) return <Screen><Header title={t('home')} /><Text>{t('noData')}</Text></Screen>;

  return (
    <Screen>
      <Header title={t('home')} subtitle={property.name} right={<TextButton title={t('landlord')} onPress={() => setMode('LANDLORD')} />} />
      <Card>
        <Text style={styles.label}>{t('nextPayment')}</Text>
        <View style={styles.paymentRow}>
          <Money amount={property.rentAmount} currency={property.rentCurrency} strong />
          <Badge text={`до ${property.paymentDueDay} числа`} tone="warning" />
        </View>
      </Card>

      <SectionTitle title={t('readings')} />
      <Card>
        <Text style={styles.title}>{incomplete ? t('submitReadings') : '✓ Done'}</Text>
        <Text style={styles.muted}>{propertyMeters.map((meter) => meter.name).join(' • ')}</Text>
        <View style={styles.gapTop}><PrimaryButton title={t('submitReadings')} onPress={() => navigation.navigate('Readings')} /></View>
      </Card>

      <SectionTitle title={t('latestInvoice')} />
      {latestInvoice ? (
        <Card>
          <View style={styles.paymentRow}>
            <View><Text style={styles.title}>{latestInvoice.period}</Text><Text style={styles.muted}>{latestInvoice.status}</Text></View>
            <SecondaryButton title={t('invoice')} onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: latestInvoice.id })} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: 7 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 5 },
  gapTop: { marginTop: spacing.md },
});
