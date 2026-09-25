import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, Money, PrimaryButton, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function PaymentsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state } = useApp();
  return (
    <Screen>
      <Header title={t('payments')} />
      <PrimaryButton title={`+ ${t('addPayment')}`} onPress={() => navigation.navigate('AddPayment')} />
      {state.payments.map((payment) => {
        const property = state.properties.find((item) => item.id === payment.propertyId);
        return (
          <Card key={payment.id}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.title}>{payment.tenantName}</Text>
                <Text style={styles.muted}>{property?.name} • {payment.date}</Text>
                <Text style={styles.muted}>{payment.method}{payment.note ? ` • ${payment.note}` : ''}</Text>
              </View>
              <View style={styles.right}>
                <Money amount={payment.amount} currency={payment.currency} strong />
                <Badge text={payment.allocated ? 'Allocated' : t('advance')} tone={payment.allocated ? 'success' : 'warning'} />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 7 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
