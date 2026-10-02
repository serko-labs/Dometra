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
  getLocaleTag,
} from '../i18n/language';

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

function formatSubmissionDate(
  value:
    string | undefined,

  locale:
    string,

  neverLabel:
    string,
) {
  if (!value) {
    return neverLabel;
  }

  const normalized =
    value.includes(
      'T',
    )
      ? value
      : `${value}T00:00:00`;

  const date =
    new Date(
      normalized,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    locale,

    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  );
}

export function MeterReadingScreen() {
  const {
    t,
    i18n,
  } =
    useTranslation();

  const locale =
    getLocaleTag(
      i18n.resolvedLanguage ??
        i18n.language,
    );

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
    tenantMode
      ? undefined
      : state.meters.find(
          item =>
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
      tenantMode,
    );

  const meter:
    Meter | undefined =
    tenantMode
      ? tenantContext?.meter
      : landlordMeter;

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
                t(
                  'meter',
                ),

                error instanceof
                Error
                  ? error.message
                  : t(
                      'meterUnavailable',
                    ),
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
      meterId,
      t,
      tenantMode,
    ],
  );

  if (
    loadingMeter
  ) {
    return (
      <Screen>
        <Header
          title={
            t(
              'meterReading',
            )
          }
          subtitle={
            t(
              'meterReadingLoading',
            )
          }
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
          title={
            t(
              'meterReading',
            )
          }
          subtitle={
            t(
              'meterNotFound',
            )
          }
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            {t(
              'meterUnavailable',
            )}
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
          subtitle={
            t(
              'fixedMonthlyService',
            )
          }
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            {t(
              'fixedAmount',
            )}
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
            {t(
              'noMeterReadingRequired',
            )}
          </Text>
        </Card>
      </Screen>
    );
  }

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
            subtitle={
              t(
                'variableService',
              )
            }
          />

          <Card>
            <Text
              style={
                styles.title
              }
            >
              {t(
                'landlordManagedService',
              )}
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              {t(
                'landlordManagedServiceDescription',
              )}
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
      amount >=
        0;

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
            t(
              'saved',
            ),

            t(
              'valueSaved',
            ),

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
            t(
              'unableToSave',
            ),

            error instanceof
            Error
              ? error.message
              : t(
                  'unableToSave',
                ),
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
          subtitle={
            t(
              'variableMonthlyService',
            )
          }
        />

        <Card>
          <Field
            label={`${t('amount')} (${meter.billingCurrency ?? 'UAH'})`}
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
                ? t(
                    'saving',
                  )
                : t(
                    'save',
                  )
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
            ?.takePictureAsync(
              {
                quality:
                  0.75,
              },
            );

        if (
          photo?.uri &&
          cameraRegisterId
        ) {
          setDraftPhotos(
            current => ({
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

          t(
            'unableToTakePhoto',
          ),
        );
      }
    };

  const selectFromGallery =
    async (
      registerId:
        string,
    ) => {
      try {
        const result =
          await ImagePicker
            .launchImageLibraryAsync(
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
            current => ({
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
            : t(
                'unableToSelectPhoto',
              ),
        );
      }
    };

  const saveAll =
    async () => {
      try {
        const readings =
          meter.registers.map(
            register => {
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
                  t(
                    'enterValidValueForRegister',

                    {
                      register:
                        register.code,
                    },
                  ),
                );
              }

              if (
                number <
                register.previousValue
              ) {
                throw new Error(
                  t(
                    'readingCannotBeLower',

                    {
                      register:
                        register.code,
                    },
                  ),
                );
              }

              if (
                !photoUri
              ) {
                throw new Error(
                  t(
                    'addNewPhotoForRegister',

                    {
                      register:
                        register.code,
                    },
                  ),
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
              t(
                'meterUnavailable',
              ),
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
          t(
            'readingSavedTitle',
          ),

          tenantMode
            ? t(
                'tenantReadingSavedMessage',
              )
            : t(
                'landlordReadingSavedMessage',
              ),

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
          t(
            'unableToSaveReading',
          ),

          error instanceof
          Error
            ? error.message
            : t(
                'unableToSaveReading',
              ),
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

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'cameraAccessDescription',
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
            title={
              t(
                'cancel',
              )
            }
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
                register =>
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
              title={
                t(
                  'takePhoto',
                )
              }
              onPress={() =>
                void capturePhoto()
              }
            />

            <SecondaryButton
              title={
                t(
                  'cancel',
                )
              }
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
        title={
          t(
            'meterReading',
          )
        }
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

      {tenantMode ? (
        <Text
          style={
            styles.tenantHint
          }
        >
          {t(
            'sendMeterValuesBeforeFifth',
          )}
        </Text>
      ) : null}

      {meter.registers.map(
        register => {
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

          const previousValue =
            register.lastValue ??
            register.previousValue;

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

              <View
                style={
                  styles.previousBox
                }
              >
                <View
                  style={
                    styles.previousColumn
                  }
                >
                  <Text
                    style={
                      styles.previousLabel
                    }
                  >
                    {t(
                      'previousValue',
                    )}
                  </Text>

                  <Text
                    style={
                      styles.previousValue
                    }
                  >
                    {previousValue}{' '}
                    {register.unit}
                  </Text>
                </View>

                <View
                  style={
                    styles.previousColumn
                  }
                >
                  <Text
                    style={
                      styles.previousLabel
                    }
                  >
                    {t(
                      'lastSubmittedLabel',
                    )}
                  </Text>

                  <Text
                    style={
                      styles.previousDate
                    }
                  >
                    {formatSubmissionDate(
                      register.lastReadingAt,

                      locale,

                      t(
                        'never',
                      ),
                    )}
                  </Text>
                </View>
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
                    {t(
                      'addNewMeterPhoto',
                    )}
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
                        ? t(
                            'retakePhoto',
                          )
                        : t(
                            'takePhoto',
                          )
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
                    title={
                      t(
                        'gallery',
                      )
                    }
                    onPress={() =>
                      void selectFromGallery(
                        register.id,
                      )
                    }
                  />
                </View>
              </View>

              <Field
                label={
                  t(
                    'currentReading',
                  )
                }
                value={
                  value
                }
                onChangeText={
                  text =>
                    setDraftValues(
                      currentValues => ({
                        ...currentValues,

                        [register.id]:
                          text,
                      }),
                    )
                }
                keyboardType="decimal-pad"
                placeholder={
                  t(
                    'currentReadingPlaceholder',
                  )
                }
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
                  {t(
                    'consumption',
                  )}
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
            ? t(
                'saving',
              )
            : t(
                'save',
              )
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

    tenantHint: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,

      marginBottom:
        spacing.sm,
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

    previousBox: {
      flexDirection:
        'row',

      gap:
        spacing.md,

      padding:
        spacing.sm,

      marginTop:
        spacing.md,

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        radius.sm,
    },

    previousColumn: {
      flex:
        1,
    },

    previousLabel: {
      color:
        colors.muted,

      fontSize:
        10,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    previousValue: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',

      marginTop:
        4,
    },

    previousDate: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '700',

      marginTop:
        4,
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