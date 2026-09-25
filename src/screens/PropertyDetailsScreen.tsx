import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, Money, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function PropertyDetailsScreen() {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { state, generateInvoice } = useApp();
  const property = state.properties.find((item) => item.id === route.params?.propertyId);
  if (!property) return <Screen><Text>Property not found</Text></Screen>;
  const meters = state.meters.filter((meter) => meter.propertyId === property.id);
  const invoices = state.invoices.filter((invoice) => invoice.propertyId === property.id);

  const createInvoice = () => {
    const invoice = generateInvoice(property.id);
    Alert.alert(t('invoiceCreated'));
    navigation.navigate('InvoiceDetails', { invoiceId: invoice.id });
  };

  return (
    <Screen>
      <Header title={property.name} subtitle={property.address} right={<Badge text={property.tenantName ? t('occupied') : t('vacant')} tone={property.tenantName ? 'success' : 'neutral'} />} />

      <Card>
        <View style={styles.rowBetween}>
          <View><Text style={styles.label}>{t('tenantLabel')}</Text><Text style={styles.value}>{property.tenantName ?? '—'}</Text></View>
          <View style={styles.alignRight}><Text style={styles.label}>{t('rent')}</Text><Money amount={property.rentAmount} currency={property.rentCurrency} strong /></View>
        </View>
      </Card>

      <SectionTitle title={t('meters')} />
      {meters.map((meter) => (
        <Card key={meter.id}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={styles.value}>{meter.name}</Text>
              <Text style={styles.muted}>{meter.registers.map((register) => `${register.code}: ${register.previousValue}`).join(' • ')}</Text>
            </View>
            <SecondaryButton title={t('readings')} onPress={() => navigation.navigate('MeterReading', { meterId: meter.id })} />
          </View>
        </Card>
      ))}
      <SecondaryButton title={`+ ${t('addMeter')}`} onPress={() => navigation.navigate('AddMeter', { propertyId: property.id })} />

      <SectionTitle title={t('invoices')} />
      {invoices.slice(0, 3).map((invoice) => (
        <Card key={invoice.id}>
          <View style={styles.rowBetween}>
            <View><Text style={styles.value}>{invoice.period}</Text><Text style={styles.muted}>{invoice.status}</Text></View>
            <SecondaryButton title={t('invoice')} onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: invoice.id })} />
          </View>
        </Card>
      ))}
      <PrimaryButton title={t('generateInvoice')} onPress={createInvoice} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  alignRight: { alignItems: 'flex-end' },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
