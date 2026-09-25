import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Field, Header, PrimaryButton, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';
import { Meter } from '../types';

const categories: { value: Meter['category']; labelKey: string }[] = [
  { value: 'ELECTRICITY', labelKey: 'electricity' },
  { value: 'WATER', labelKey: 'water' },
  { value: 'GAS', labelKey: 'gas' },
];

export function AddMeterScreen() {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addMeter } = useApp();
  const propertyId = route.params?.propertyId as string;
  const [name, setName] = useState(t('electricity'));
  const [category, setCategory] = useState<Meter['category']>('ELECTRICITY');
  const [dual, setDual] = useState(true);

  const submit = () => {
    if (!propertyId) return;
    const meter = addMeter({ propertyId, name: name.trim() || t('meters'), category, dualTariff: dual && category === 'ELECTRICITY' });
    Alert.alert('Dometra', 'Meter created.');
    navigation.replace('MeterReading', { meterId: meter.id });
  };

  return (
    <Screen>
      <Header title={t('addMeter')} />
      <Field label={t('name')} value={name} onChangeText={setName} />
      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {categories.map((item) => (
          <Pressable key={item.value} onPress={() => { setCategory(item.value); setName(t(item.labelKey)); if (item.value !== 'ELECTRICITY') setDual(false); }} style={[styles.chip, category === item.value && styles.chipActive]}>
            <Text style={[styles.chipText, category === item.value && styles.chipTextActive]}>{t(item.labelKey)}</Text>
          </Pressable>
        ))}
      </View>
      {category === 'ELECTRICITY' ? (
        <>
          <Text style={styles.label}>Tariff registers</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setDual(false)} style={[styles.chip, !dual && styles.chipActive]}><Text style={[styles.chipText, !dual && styles.chipTextActive]}>{t('singleTariff')}</Text></Pressable>
            <Pressable onPress={() => setDual(true)} style={[styles.chip, dual && styles.chipActive]}><Text style={[styles.chipText, dual && styles.chipTextActive]}>{t('dualTariff')}</Text></Pressable>
          </View>
        </>
      ) : null}
      <PrimaryButton title={t('create')} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextActive: { color: colors.primary },
});
