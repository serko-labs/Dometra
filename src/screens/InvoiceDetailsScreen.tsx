import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Divider, Header, Money, Screen, SectionTitle } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function InvoiceDetailsScreen() {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const { state } = useApp();
  const invoice = state.invoices.find((item) => item.id === route.params?.invoiceId);
  if (!invoice) return <Screen><Text>Invoice not found</Text></Screen>;
  const property = state.properties.find((item) => item.id === invoice.propertyId);
  const totals = invoice.lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.currency] = (acc[line.currency] ?? 0) + line.amount;
    return acc;
  }, {});

  return (
    <Screen>
      <Header title={`${t('invoice')} • ${invoice.period}`} subtitle={property?.name} right={<Badge text={invoice.status} tone={invoice.status === 'PAID' ? 'success' : 'warning'} />} />
      <Card>
        <View style={styles.rowBetween}><Text style={styles.muted}>{t('tenantLabel')}</Text><Text style={styles.value}>{invoice.tenantName}</Text></View>
        <Divider />
        <View style={styles.rowBetween}><Text style={styles.muted}>{t('due')}</Text><Text style={styles.value}>{invoice.dueDate}</Text></View>
      </Card>
      <SectionTitle title={t('utilities')} />
      <Card>
        {invoice.lines.map((line, index) => (
          <View key={line.id}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.rowBetween}>
              <View style={styles.flex}><Text style={styles.value}>{line.label}</Text>{line.details ? <Text style={styles.muted}>{line.details}</Text> : null}</View>
              <Money amount={line.amount} currency={line.currency} strong />
            </View>
          </View>
        ))}
      </Card>
      <SectionTitle title={t('total')} />
      <Card>
        {Object.entries(totals).map(([currency, amount]) => (
          <View key={currency} style={styles.totalRow}><Text style={styles.totalLabel}>{currency}</Text><Money amount={amount} currency={currency as any} strong /></View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  muted: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 15, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  totalLabel: { color: colors.muted, fontWeight: '700' },
});
