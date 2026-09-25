import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Field, Header, PrimaryButton, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CurrencyCode } from '../types';

export function AddPropertyScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { addProperty } = useApp();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Чернівці');
  const [area, setArea] = useState('');
  const [rent, setRent] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  const submit = () => {
    if (!name.trim() || !address.trim() || Number(area) <= 0 || Number(rent) <= 0) {
      Alert.alert('Dometra', 'Fill all required fields.');
      return;
    }
    const property = addProperty({ name: name.trim(), address: address.trim(), city: city.trim(), areaM2: Number(area), rentAmount: Number(rent), rentCurrency: currency });
    navigation.replace('PropertyDetails', { propertyId: property.id });
  };

  return (
    <Screen>
      <Header title={t('addProperty')} />
      <Field label={t('name')} value={name} onChangeText={setName} placeholder="Central Residence, apt. 12" />
      <Field label={t('address')} value={address} onChangeText={setAddress} placeholder="вул. Головна, 100, кв. 12" />
      <Field label={t('city')} value={city} onChangeText={setCity} />
      <Field label={t('area')} value={area} onChangeText={setArea} keyboardType="decimal-pad" />
      <Field label={t('monthlyRent')} value={rent} onChangeText={setRent} keyboardType="decimal-pad" />
      <Field label={t('currency')} value={currency} onChangeText={(value) => setCurrency((value.toUpperCase() as CurrencyCode) || 'USD')} autoCapitalize="characters" />
      <PrimaryButton title={t('create')} onPress={submit} />
    </Screen>
  );
}
