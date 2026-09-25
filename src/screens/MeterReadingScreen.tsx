import React, { useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Field, Header, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';

export function MeterReadingScreen() {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const { state, saveReading } = useApp();
  const meter = state.meters.find((item) => item.id === route.params?.meterId);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraRegisterId, setCameraRegisterId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftPhotos, setDraftPhotos] = useState<Record<string, string>>({});

  if (!meter) return <Screen><Text>Meter not found</Text></Screen>;

  const capture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.65 });
    if (photo?.uri && cameraRegisterId) setDraftPhotos((current) => ({ ...current, [cameraRegisterId]: photo.uri }));
    setCameraRegisterId(null);
  };

  if (cameraRegisterId) {
    if (!permission?.granted) {
      return (
        <Screen scroll={false} style={styles.center}>
          <Text style={styles.title}>{t('cameraPermission')}</Text>
          <PrimaryButton title={t('allowCamera')} onPress={() => void requestPermission()} />
          <SecondaryButton title="Cancel" onPress={() => setCameraRegisterId(null)} />
        </Screen>
      );
    }
    return (
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraTitle}>{meter.name} • {meter.registers.find((register) => register.id === cameraRegisterId)?.code}</Text>
          <View style={styles.captureButtonWrap}><PrimaryButton title={t('takePhoto')} onPress={() => void capture()} /></View>
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <Header title={t('meterReading')} subtitle={`${meter.name}${meter.serialNumber ? ` • ${meter.serialNumber}` : ''}`} />
      {meter.registers.map((register) => {
        const value = draftValues[register.id] ?? (register.currentValue !== undefined ? String(register.currentValue) : '');
        const photo = draftPhotos[register.id] ?? register.photoUri;
        const current = Number(value);
        const consumption = Number.isFinite(current) ? current - register.previousValue : 0;
        const valid = Number.isFinite(current) && current >= register.previousValue;
        return (
          <Card key={register.id}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.title}>{register.code} — {register.name}</Text>
                <Text style={styles.muted}>{t('previousReading')}: {register.previousValue} {register.unit}</Text>
              </View>
              <Badge text={`${register.tariff.toFixed(2)} ${register.tariffCurrency}/${register.unit}`} />
            </View>
            {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
            <SecondaryButton title={photo ? t('retakePhoto') : t('takePhoto')} onPress={() => setCameraRegisterId(register.id)} />
            <Field label={t('currentReading')} value={value} onChangeText={(text) => setDraftValues((currentDrafts) => ({ ...currentDrafts, [register.id]: text }))} keyboardType="decimal-pad" />
            <View style={styles.calcRow}>
              <Text style={styles.muted}>{t('consumption')}</Text>
              <Text style={[styles.calcValue, !valid && value ? styles.invalid : undefined]}>{valid ? `${consumption.toFixed(2)} ${register.unit}` : '—'}</Text>
            </View>
            <PrimaryButton
              title={t('saveReading')}
              disabled={!valid || !photo}
              onPress={() => {
                saveReading(meter.id, register.id, current, photo);
                Alert.alert(t('readingSaved'));
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
  photo: { width: '100%', height: 170, borderRadius: radius.sm, backgroundColor: colors.border, marginVertical: spacing.md },
  calcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  calcValue: { color: colors.success, fontWeight: '800' },
  invalid: { color: colors.danger },
  center: { justifyContent: 'center', gap: spacing.md },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', paddingTop: 70, paddingHorizontal: 20, paddingBottom: 40 },
  cameraTitle: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 10 },
  captureButtonWrap: { alignSelf: 'stretch' },
});
