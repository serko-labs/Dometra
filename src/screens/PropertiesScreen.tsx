import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, Money, PrimaryButton, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function PropertiesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state } = useApp();
  return (
    <Screen>
      <Header title={t('properties')} subtitle={`${state.properties.length} / 4`} />
      <PrimaryButton title={`+ ${t('addProperty')}`} onPress={() => navigation.navigate('AddProperty')} />
      {state.properties.map((property) => (
        <Pressable key={property.id} onPress={() => navigation.navigate('PropertyDetails', { propertyId: property.id })}>
          <Card>
            <View style={styles.row}>
              <View style={styles.icon}><Text style={styles.iconText}>⌂</Text></View>
              <View style={styles.flex}>
                <Text style={styles.title}>{property.name}</Text>
                <Text style={styles.address}>{property.address}</Text>
                <View style={styles.meta}>
                  <Badge text={property.tenantName ? t('occupied') : t('vacant')} tone={property.tenantName ? 'success' : 'neutral'} />
                  <Text style={styles.area}>{property.areaM2} m²</Text>
                </View>
              </View>
              <Money amount={property.rentAmount} currency={property.rentCurrency} strong />
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, color: colors.primary },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  address: { color: colors.muted, fontSize: 12, marginTop: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 9 },
  area: { color: colors.muted, fontSize: 12 },
});
