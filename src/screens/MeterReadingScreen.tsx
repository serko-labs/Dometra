import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import * as ImagePicker from 'expo-image-picker';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  useTranslation,
} from 'react-i18next';

import {
  Badge,
  Card,
  Field,
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  loadTenantMeterContext,
  saveTenantMeterReadings,
  TenantMeterContext,
} from '../services/tenantPortalRepository';

import {
  Meter,
} from '../types';

import {
  colors,
  radius,
  spacing,
} from '../theme';

export function MeterReadingScreen() {
  const {
    t,
  } =
    useTranslation();

  const route =
    useRoute<any>();

  const navigation =
    useNavigation<any>();

  const {
    state,
    saveMeterReadings,
    saveVariableAmount,
  } =
    useApp();

  const meterId =
    route.params
      ?.meterId as string;

  const source =
    route.params
      ?.source as
      | 'TENANT'
      | undefined;

  const tenantMode =
    source ===
      'TENANT' ||
    state.settings.activeMode ===
      'TENANT';

  const landlordMeter =
    state.meters.find(
      (
        item,
      ) =>
        item.id ===
        meterId,
    );

  const [
    tenantContext,
    setTenantContext,
  ] =
    useState<
      TenantMeterContext | null
    >(null);

  const [
    loadingMeter,
    setLoadingMeter,
  ] =
    useState(
      tenantMode &&
      !landlordMeter,
    );

  const meter:
    Meter | undefined =
    landlordMeter ??
    tenantContext?.meter;

  const [
    cameraPermission,
    requestCameraPermission,
  ] =
    useCameraPermissions();

  const cameraRef =
    useRef<
      CameraView | null
    >(null);

  const [
    cameraRegisterId,
    setCameraRegisterId,
  ] =
    useState<
      string | null
    >(null);

  /*
   * Every visit starts blank.
   *
   * Historical values stay in Supabase and
   * are visible on Readings / History pages.
   */
  const [
    draftValues,
    setDraftValues,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    draftPhotos,
    setDraftPhotos,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    variableAmount,
    setVariableAmount,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  useEffect(
    () => {
      if (
        !tenantMode ||
        landlordMeter ||
        !meterId
      ) {
        return;
      }

      let active =
        true;

      const load =
        async () => {
          setLoadingMeter(
            true,
          );

          try {
            const context =
              await loadTenantMeterContext(
                meterId,
              );

            if (
              active
            ) {
              setTenantContext(
                context,
              );
            }
          } catch (
            error
          ) {
            if (
              active
            ) {
              Alert.alert(
                'Meter',
                error instanceof
                Error
                  ? error.message
                  : 'Unable to load meter.',
              );
            }
          } finally {
            if (
              active
            ) {
              setLoadingMeter(
                false,
              );
            }
          }
        };

      void load();

      return () => {
        active =
          false;
      };
    },
    [
      tenantMode,
      landlordMeter,
      meterId,
    ],
  );

  if (
    loadingMeter
  ) {
    return (
      <Screen>
        <Header
          title="Meter reading"
          subtitle="Loading meter..."
        />
      </Screen>
    );
  }

  if (
    !meter
  ) {
    return (
      <Screen>
        <Header
          title="Meter reading"
          subtitle="Meter not found"
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            This meter is not available for the current account.
          </Text>
        </Card>
      </Screen>
    );
  }

  const returnAfterSave =
    () => {
      if (
        tenantMode
      ) {
        if (
          navigation.canGoBack()
        ) {
          navigation.goBack();
        } else {
          navigation.navigate(
            'Main',
          );
        }

        return;
      }

      navigation.popTo(
        'PropertyDetails',

        {
          propertyId:
            meter.propertyId,
        },
      );
    };

  /*
   * ----------------------------------------------------------
   * FIXED SERVICE
   * ----------------------------------------------------------
   */

  if (
    meter.billingMode ===
    'FIXED'
  ) {
    return (
      <Screen>
        <Header
          title={
            meter.name
          }
          subtitle="Fixed monthly service"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            Fixed amount
          </Text>

          <Text
            style={
              styles.fixedValue
            }
          >
            {
              meter.fixedAmount ??
              0
            }{' '}
            {meter.billingCurrency ??
              'UAH'}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            No meter reading is required for this service.
          </Text>
        </Card>
      </Screen>
    );
  }

  /*
   * ----------------------------------------------------------
   * VARIABLE SERVICE
   * ----------------------------------------------------------
   */

  if (
    meter.billingMode ===
    'VARIABLE'
  ) {
    if (
      tenantMode
    ) {
      return (
        <Screen>
          <Header
            title={
              meter.name
            }
            subtitle="Variable service"
          />

          <Card>
            <Text
              style={
                styles.title
              }
            >
              Landlord-managed service
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              Variable service charges are currently entered by the landlord.
            </Text>
          </Card>
        </Screen>
      );
    }

    const amount =
      Number(
        variableAmount.replace(
          ',',
          '.',
        ),
      );

    const valid =
      variableAmount.trim() !==
        '' &&
      Number.isFinite(
        amount,
      ) &&
      amount >= 0;

    const saveVariable =
      async () => {
        if (
          !valid
        ) {
          return;
        }

        setBusy(
          true,
        );

        try {
          await saveVariableAmount(
            meter.id,
            amount,
          );

          Alert.alert(
            'Saved',
            'The value has been saved.',
            [
              {
                text:
                  'OK',

                onPress:
                  returnAfterSave,
              },
            ],
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Unable to save',
            error instanceof
            Error
              ? error.message
              : 'Unknown error.',
          );
        } finally {
          setBusy(
            false,
          );
        }
      };

    return (
      <Screen>
        <Header
          title={
            meter.name
          }
          subtitle="Variable monthly service"
        />

        <Card>
          <Field
            label={`Amount (${meter.billingCurrency ?? 'UAH'})`}
            value={
              variableAmount
            }
            onChangeText={
              setVariableAmount
            }
            keyboardType="decimal-pad"
            placeholder="0"
            editable={
              !busy
            }
          />

          <PrimaryButton
            title={
              busy
                ? 'Saving...'
                : 'Save'
            }
            disabled={
              !valid ||
              busy
            }
            onPress={() =>
              void saveVariable()
            }
          />
        </Card>
      </Screen>
    );
  }

  /*
   * ----------------------------------------------------------
   * CAMERA
   * ----------------------------------------------------------
   */

  const capturePhoto =
    async () => {
      try {
        const photo =
          await cameraRef.current
            ?.takePictureAsync({
              quality:
                0.75,
            });

        if (
          photo?.uri &&
          cameraRegisterId
        ) {
          setDraftPhotos(
            (
              current,
            ) => ({
              ...current,

              [cameraRegisterId]:
                photo.uri,
            }),
          );
        }

        setCameraRegisterId(
          null,
        );
      } catch (
        error
      ) {
        console.error(
          '[Dometra] Camera capture failed:',
          error,
        );

        Alert.alert(
          'Dometra',
          'Unable to take photo.',
        );
      }
    };

  /*
   * ----------------------------------------------------------
   * GALLERY
   * ----------------------------------------------------------
   */

  const selectFromGallery =
    async (
      registerId:
        string,
    ) => {
      try {
        const result =
          await ImagePicker.launchImageLibraryAsync(
            {
              mediaTypes: [
                'images',
              ],

              allowsEditing:
                false,

              quality:
                0.8,

              selectionLimit:
                1,
            },
          );

        if (
          result.canceled
        ) {
          return;
        }

        const selected =
          result.assets[0];

        if (
          selected?.uri
        ) {
          setDraftPhotos(
            (
              current,
            ) => ({
              ...current,

              [registerId]:
                selected.uri,
            }),
          );
        }
      } catch (
        error
      ) {
        Alert.alert(
          'Dometra',
          error instanceof
          Error
            ? error.message
            : 'Unable to select photo.',
        );
      }
    };

  /*
   * ----------------------------------------------------------
   * SAVE
   * ----------------------------------------------------------
   */

  const saveAll =
    async () => {
      try {
        const readings =
          meter.registers.map(
            (
              register,
            ) => {
              const value =
                draftValues[
                  register.id
                ] ??
                '';

              const photoUri =
                draftPhotos[
                  register.id
                ];

              const number =
                Number(
                  value
                    .trim()
                    .replace(
                      ',',
                      '.',
                    ),
                );

              if (
                !value.trim() ||
                !Number.isFinite(
                  number,
                )
              ) {
                throw new Error(
                  `Enter a valid value for ${register.code}.`,
                );
              }

              if (
                number <
                register.previousValue
              ) {
                throw new Error(
                  `${register.code} cannot be lower than the last valid reading.`,
                );
              }

              if (
                !photoUri
              ) {
                throw new Error(
                  `Add a new photo for ${register.code}.`,
                );
              }

              return {
                registerId:
                  register.id,

                currentValue:
                  number,

                photoUri,
              };
            },
          );

        setBusy(
          true,
        );

        if (
          tenantMode
        ) {
          if (
            !tenantContext
          ) {
            throw new Error(
              'Tenant meter context is not available.',
            );
          }

          await saveTenantMeterReadings(
            tenantContext,
            readings,
          );
        } else {
          await saveMeterReadings(
            meter.id,
            readings,
          );
        }

        Alert.alert(
          'Reading saved',
          tenantMode
            ? 'Your meter reading has been sent successfully.'
            : 'The new meter reading has been saved.',
          [
            {
              text:
                'OK',

              onPress:
                returnAfterSave,
            },
          ],
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to save reading',
          error instanceof
          Error
            ? error.message
            : 'Unknown error.',
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  /*
   * ----------------------------------------------------------
   * CAMERA SCREEN
   * ----------------------------------------------------------
   */

  if (
    cameraRegisterId
  ) {
    if (
      !cameraPermission
        ?.granted
    ) {
      return (
        <Screen
          scroll={
            false
          }
          style={
            styles.center
          }
        >
          <Text
            style={
              styles.title
            }
          >
            {t(
              'cameraPermission',
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Dometra needs camera access to photograph the meter.
          </Text>

          <PrimaryButton
            title={
              t(
                'allowCamera',
              )
            }
            onPress={() =>
              void requestCameraPermission()
            }
          />

          <SecondaryButton
            title="Cancel"
            onPress={() =>
              setCameraRegisterId(
                null,
              )
            }
          />
        </Screen>
      );
    }

    return (
      <View
        style={
          styles.cameraScreen
        }
      >
        <CameraView
          ref={
            cameraRef
          }
          style={
            StyleSheet.absoluteFill
          }
          facing="back"
        />

        <View
          style={
            styles.cameraOverlay
          }
        >
          <Text
            style={
              styles.cameraTitle
            }
          >
            {meter.name}
            {' • '}
            {
              meter.registers.find(
                (
                  register,
                ) =>
                  register.id ===
                  cameraRegisterId,
              )?.code
            }
          </Text>

          <View
            style={
              styles.captureButtonWrap
            }
          >
            <PrimaryButton
              title="Take photo"
              onPress={() =>
                void capturePhoto()
              }
            />

            <SecondaryButton
              title="Cancel"
              onPress={() =>
                setCameraRegisterId(
                  null,
                )
              }
            />
          </View>
        </View>
      </View>
    );
  }

  /*
   * ----------------------------------------------------------
   * NEW READING
   * ----------------------------------------------------------
   */

  return (
    <Screen>
      <Header
        title="Meter reading"
        subtitle={
          tenantContext
            ?.propertyName ??
          meter.name
        }
      />

      <Text
        style={
          styles.meterTitle
        }
      >
        {meter.name}
      </Text>

      {meter.registers.map(
        (
          register,
        ) => {
          const value =
            draftValues[
              register.id
            ] ??
            '';

          const photo =
            draftPhotos[
              register.id
            ];

          const current =
            Number(
              value
                .trim()
                .replace(
                  ',',
                  '.',
                ),
            );

          const valid =
            value.trim() !==
              '' &&
            Number.isFinite(
              current,
            ) &&
            current >=
              register.previousValue;

          const consumption =
            valid
              ? current -
                register.previousValue
              : 0;

          return (
            <Card
              key={
                register.id
              }
            >
              <View
                style={
                  styles.rowBetween
                }
              >
                <View
                  style={
                    styles.flex
                  }
                >
                  <Text
                    style={
                      styles.title
                    }
                  >
                    {
                      register.code
                    }
                    {' — '}
                    {
                      register.name
                    }
                  </Text>
                </View>

                <Badge
                  text={`${register.tariff} ${register.tariffCurrency}/${register.unit}`}
                />
              </View>

              {photo ? (
                <Image
                  source={{
                    uri:
                      photo,
                  }}
                  style={
                    styles.photo
                  }
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={
                    styles.emptyPhoto
                  }
                >
                  <Text
                    style={
                      styles.emptyPhotoIcon
                    }
                  >
                    ▧
                  </Text>

                  <Text
                    style={
                      styles.emptyPhotoText
                    }
                  >
                    Add a new meter photo
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.photoActions
                }
              >
                <View
                  style={
                    styles.flex
                  }
                >
                  <SecondaryButton
                    title={
                      photo
                        ? 'Retake'
                        : 'Take photo'
                    }
                    onPress={() =>
                      setCameraRegisterId(
                        register.id,
                      )
                    }
                  />
                </View>

                <View
                  style={
                    styles.flex
                  }
                >
                  <SecondaryButton
                    title="Gallery"
                    onPress={() =>
                      void selectFromGallery(
                        register.id,
                      )
                    }
                  />
                </View>
              </View>

              <Field
                label="Current reading"
                value={
                  value
                }
                onChangeText={(
                  text,
                ) =>
                  setDraftValues(
                    (
                      current,
                    ) => ({
                      ...current,

                      [register.id]:
                        text,
                    }),
                  )
                }
                keyboardType="decimal-pad"
                placeholder="Enter reading"
                editable={
                  !busy
                }
              />

              <View
                style={
                  styles.consumptionRow
                }
              >
                <Text
                  style={
                    styles.muted
                  }
                >
                  Consumption
                </Text>

                <Text
                  style={
                    styles.consumption
                  }
                >
                  {valid
                    ? `${consumption.toFixed(
                        2,
                      )} ${register.unit}`
                    : '—'}
                </Text>
              </View>
            </Card>
          );
        },
      )}

      <PrimaryButton
        title={
          busy
            ? 'Saving...'
            : 'Save'
        }
        disabled={
          busy
        }
        onPress={() =>
          void saveAll()
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex:
        1,
    },

    meterTitle: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '800',
    },

    rowBetween: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    title: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    fixedValue: {
      color:
        colors.text,

      fontSize:
        28,

      fontWeight:
        '800',

      marginTop:
        spacing.sm,

      marginBottom:
        spacing.sm,
    },

    photo: {
      width:
        '100%',

      height:
        190,

      borderRadius:
        radius.sm,

      marginVertical:
        spacing.md,

      backgroundColor:
        colors.border,
    },

    emptyPhoto: {
      height:
        145,

      marginVertical:
        spacing.md,

      borderWidth:
        1,

      borderStyle:
        'dashed',

      borderColor:
        colors.border,

      borderRadius:
        radius.sm,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    emptyPhotoIcon: {
      color:
        colors.muted,

      fontSize:
        28,
    },

    emptyPhotoText: {
      color:
        colors.muted,

      fontSize:
        13,

      fontWeight:
        '600',
    },

    photoActions: {
      flexDirection:
        'row',

      gap:
        spacing.sm,

      marginBottom:
        spacing.md,
    },

    consumptionRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginTop:
        spacing.sm,
    },

    consumption: {
      color:
        colors.text,

      fontWeight:
        '700',

      fontSize:
        13,
    },

    center: {
      justifyContent:
        'center',

      gap:
        spacing.md,
    },

    cameraScreen: {
      flex:
        1,

      backgroundColor:
        '#000',
    },

    cameraOverlay: {
      flex:
        1,

      justifyContent:
        'space-between',

      padding:
        30,

      paddingTop:
        70,
    },

    cameraTitle: {
      color:
        '#FFFFFF',

      fontSize:
        18,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    captureButtonWrap: {
      gap:
        spacing.sm,
    },
  });