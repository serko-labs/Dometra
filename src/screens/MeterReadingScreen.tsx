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
    useState(
      meter?.currentAmount !==
      undefined
        ? String(
            meter.currentAmount,
          )
        : '',
    );

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

  const returnToProperty =
    () => {
      navigation.navigate(
        'PropertyDetails',

        {
          propertyId:
            meter.propertyId,
        },
      );
    };

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
        </Card>
      </Screen>
    );
  }

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
        Alert.alert(
          'Dometra',
          'Unable to take photo.',
        );
      }
    };

  const selectFromGallery =
    async (
      registerId:
        string,
    ) => {
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
    };

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
                (
                  register.currentValue !==
                  undefined
                    ? String(
                        register.currentValue,
                      )
                    : ''
                );

              const photoUri =
                draftPhotos[
                  register.id
                ] ??
                register.photoUri;

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
                  `${register.code} cannot be lower than ${register.previousValue} ${register.unit}.`,
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
          'The meter reading and photos are stored in Dometra.',
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
            {
              meter.name
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
            (
              register.currentValue !==
              undefined
                ? String(
                    register.currentValue,
                  )
                : ''
            );

          const photo =
            draftPhotos[
              register.id
            ] ??
            register.photoUri;

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
                <View>
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

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    Previous:
                    {' '}
                    {
                      register.previousValue
                    }{' '}
                    {
                      register.unit
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
                />
              ) : (
                <View
                  style={
                    styles.emptyPhoto
                  }
                >
                  <Text
                    style={
                      styles.emptyPhotoText
                    }
                  >
                    No photo
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
                editable={
                  !busy
                }
              />

              <Text
                style={
                  styles.consumption
                }
              >
                Consumption:{' '}
                {valid
                  ? `${(
                      current -
                      register.previousValue
                    ).toFixed(
                      2,
                    )} ${register.unit}`
                  : '—'}
              </Text>
            </Card>
          );
        },
      )}

      <PrimaryButton
        title={
          busy
            ? 'Saving to Dometra...'
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
        140,

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

      marginVertical:
        spacing.md,
    },

    emptyPhotoText: {
      color:
        colors.muted,
    },

    photoActions: {
      flexDirection:
        'row',

      gap:
        spacing.sm,
    },

    consumption: {
      color:
        colors.muted,

      fontSize:
        13,

      marginTop:
        spacing.sm,
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
        '#fff',

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