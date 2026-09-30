import React, {
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

  const meter =
    state.meters.find(
      (
        item,
      ) =>
        item.id ===
        route.params?.meterId,
    );

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
   * IMPORTANT:
   *
   * These are intentionally empty.
   *
   * Previous readings live in Supabase/history
   * and are never prefilled into a new entry.
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

  if (
    !meter
  ) {
    return (
      <Screen>
        <Text>
          Meter not found
        </Text>
      </Screen>
    );
  }

  /*
   * Go back to the EXISTING apartment route.
   *
   * Do not navigate() to a new copy of it.
   */
  const returnToProperty =
    () => {
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
            This service has a fixed monthly value.
            No reading is required.
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
                  returnToProperty,
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
          <Text
            style={
              styles.muted
            }
          >
            Enter a value for the current billing period.
            Previous values are available in apartment history.
          </Text>

          <Field
            label={`Amount (${meter.billingCurrency ?? 'UAH'})`}
            value={
              variableAmount
            }
            onChangeText={
              setVariableAmount
            }
            keyboardType="decimal-pad"
            editable={
              !busy
            }
            placeholder="0"
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
        console.error(
          '[Dometra] Gallery selection failed:',
          error,
        );

        Alert.alert(
          'Dometra',
          'Unable to select photo.',
        );
      }
    };

  /*
   * ----------------------------------------------------------
   * SAVE ALL REGISTERS
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
              /*
               * NEVER fallback to register.currentValue.
               *
               * New form = new blank entry.
               */
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

              /*
               * We still validate against the previous saved
               * reading internally, but don't show that value.
               */
              if (
                number <
                register.previousValue
              ) {
                throw new Error(
                  `${register.code} cannot be lower than the last saved reading.`,
                );
              }

              if (
                !photoUri
              ) {
                throw new Error(
                  `Add a photo for ${register.code}.`,
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

        await saveMeterReadings(
          meter.id,
          readings,
        );

        Alert.alert(
          'Reading saved',
          'The new meter reading has been saved.',
          [
            {
              text:
                'OK',

              onPress:
                returnToProperty,
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
   * NEW READING FORM
   * ----------------------------------------------------------
   */

  return (
    <Screen>
      <Header
        title="Meter reading"
        subtitle={
          meter.name
        }
      />

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
                      currentDrafts,
                    ) => ({
                      ...currentDrafts,

                      [register.id]:
                        text,
                    }),
                  )
                }
                keyboardType="decimal-pad"
                editable={
                  !busy
                }
                placeholder="Enter reading"
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

      marginTop:
        4,

      lineHeight:
        18,
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