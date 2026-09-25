import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function InvoicesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state } = useApp();
  return (
    <Screen>
      <Header title={t('invoices')} />
      {state.invoices.map((invoice) => {
        const property = state.properties.find((item) => item.id === invoice.propertyId);
        return (
          <Pressable key={invoice.id} onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: invoice.id })}>
            <Card>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{property?.name ?? invoice.tenantName}</Text>
                  <Text style={styles.muted}>{invoice.period} • {invoice.dueDate}</Text>
                </View>
                <Badge text={invoice.status} tone={invoice.status === 'PAID' ? 'success' : invoice.status === 'OVERDUE' ? 'danger' : 'warning'} />
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 5 },
});
