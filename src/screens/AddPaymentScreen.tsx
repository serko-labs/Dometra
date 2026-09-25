import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Field, Header, PrimaryButton, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';
import { CurrencyCode, PaymentMethod } from '../types';

export function AddPaymentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state, addPayment } = useApp();
  const [propertyId, setPropertyId] = useState(state.properties.find((property) => property.tenantName)?.id ?? state.properties[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UAH');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [note, setNote] = useState('');

  const submit = () => {
    if (!propertyId || Number(amount) <= 0) return;
    addPayment({ propertyId, amount: Number(amount), currency, method, note });
    Alert.alert(t('paymentSaved'));
    navigation.goBack();
  };

  return (
    <Screen>
      <Header title={t('addPayment')} />
      <Text style={styles.label}>{t('properties')}</Text>
      <View style={styles.wrap}>
        {state.properties.filter((property) => property.tenantName).map((property) => (
          <Pressable key={property.id} onPress={() => setPropertyId(property.id)} style={[styles.chip, propertyId === property.id && styles.active]}>
            <Text style={[styles.chipText, propertyId === property.id && styles.activeText]}>{property.name}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={t('amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label={t('currency')} value={currency} onChangeText={(value) => setCurrency(value.toUpperCase() as CurrencyCode)} autoCapitalize="characters" />
      <Text style={styles.label}>{t('method')}</Text>
      <View style={styles.wrap}>
        {(['BANK_TRANSFER', 'CASH', 'CARD'] as PaymentMethod[]).map((item) => (
          <Pressable key={item} onPress={() => setMethod(item)} style={[styles.chip, method === item && styles.active]}>
            <Text style={[styles.chipText, method === item && styles.activeText]}>{item.replace('_', ' ')}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={t('note')} value={note} onChangeText={setNote} />
      <PrimaryButton title={t('save')} onPress={submit} disabled={!propertyId || Number(amount) <= 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '700', fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm },
  active: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  activeText: { color: colors.primary },
});
