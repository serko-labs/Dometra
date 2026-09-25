import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Header, Screen } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, spacing } from '../theme';

export function ReadingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { state } = useApp();
  const rentedProperty = state.properties.find((property) => property.tenantName);
  const meters = state.meters.filter((meter) => meter.propertyId === rentedProperty?.id);
  return (
    <Screen>
      <Header title={t('readings')} subtitle={rentedProperty?.name} />
      {meters.map((meter) => {
        const done = meter.registers.filter((register) => register.currentValue !== undefined).length;
        return (
          <Pressable key={meter.id} onPress={() => navigation.navigate('MeterReading', { meterId: meter.id })}>
            <Card>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{meter.name}</Text>
                  <Text style={styles.muted}>{meter.registers.map((register) => register.code).join(' + ')} • {done}/{meter.registers.length}</Text>
                </View>
                <Badge text={done === meter.registers.length ? 'Done' : t('submitReadings')} tone={done === meter.registers.length ? 'success' : 'warning'} />
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
