import React, {
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
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
  createManualTenancy,
  createTenantInvitation,
} from '../services/tenantRepository';

import {
  CurrencyCode,
  TenantProfileInput,
  TenancyOpeningReadingInput,
  TenancyTermsInput,
} from '../types';

import {
  colors,
  radius,
  spacing,
} from '../theme';

type Mode =
  'MANUAL' | 'INVITE';

const currencies:
  CurrencyCode[] = [
  'UAH',
  'USD',
  'EUR',
];


function parseNumber(
  value: string,
) {
  if (
    !value.trim()
  ) {
    return undefined;
  }

  const parsed =
    Number(
      value
        .trim()
        .replace(
          ',',
          '.',
        ),
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : undefined;
}


function isDate(
  value: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(
        value,
      )
  ) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00`,
    );

  return !Number.isNaN(
    date.getTime(),
  );
}


export function TenancyTermsScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    state,
  } =
    useApp();

  const mode =
    route.params
      ?.mode as Mode;

  const propertyId =
    route.params
      ?.propertyId as string;

  const tenantProfile =
    route.params
      ?.tenantProfile as
      | TenantProfileInput
      | undefined;

  const property =
    state.properties.find(
      (
        item,
      ) =>
        item.id ===
        propertyId,
    );

  const propertyMeters =
    useMemo(
      () =>
        state.meters.filter(
          (
            meter,
          ) =>
            meter.propertyId ===
              propertyId &&
            meter.billingMode ===
              'METERED',
        ),
      [
        state.meters,
        propertyId,
      ],
    );

  const [
    rentAmount,
    setRentAmount,
  ] =
    useState('');

  const [
    currency,
    setCurrency,
  ] =
    useState<CurrencyCode>(
      'USD',
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState('');

  const [
    paymentDueDay,
    setPaymentDueDay,
  ] =
    useState('5');

  const [
    endDate,
    setEndDate,
  ] =
    useState('');

  const [
    autoProlongation,
    setAutoProlongation,
  ] =
    useState(false);

  const [
    depositAmount,
    setDepositAmount,
  ] =
    useState('');

  const [
    depositCurrency,
    setDepositCurrency,
  ] =
    useState<CurrencyCode>(
      'USD',
    );

  const [
    agreementUri,
    setAgreementUri,
  ] =
    useState<
      string | undefined
    >();

  const [
    openingValues,
    setOpeningValues,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    busy,
    setBusy,
  ] =
    useState(false);


  const chooseAgreement =
    async () => {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              'images',
            ],

            allowsEditing:
              false,

            quality:
              0.85,

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
        setAgreementUri(
          selected.uri,
        );
      }
    };


  const useLatestReadings =
    () => {
      const next:
        Record<
          string,
          string
        > = {};

      for (
        const meter
        of propertyMeters
      ) {
        for (
          const register
          of meter.registers
        ) {
          if (
            register.lastValue !==
            undefined
          ) {
            next[
              register.id
            ] =
              String(
                register.lastValue,
              );
          }
        }
      }

      setOpeningValues(
        next,
      );
    };


  const buildOpeningReadings =
    () => {
      const result:
        TenancyOpeningReadingInput[] =
        [];

      for (
        const meter
        of propertyMeters
      ) {
        for (
          const register
          of meter.registers
        ) {
          const value =
            openingValues[
              register.id
            ];

          if (
            !value?.trim()
          ) {
            continue;
          }

          const parsed =
            parseNumber(
              value,
            );

          if (
            parsed ===
              undefined ||
            parsed < 0
          ) {
            throw new Error(
              `Enter a valid opening value for ${meter.name} ${register.code}.`,
            );
          }

          result.push({
            meterRegisterId:
              register.id,

            value:
              parsed,
          });
        }
      }

      return result;
    };


  const buildTerms =
    (): TenancyTermsInput => {
      const rent =
        parseNumber(
          rentAmount,
        );

      if (
        rent ===
          undefined ||
        rent < 0
      ) {
        throw new Error(
          'Enter a valid rental payment.',
        );
      }

      if (
        !startDate.trim() ||
        !isDate(
          startDate.trim(),
        )
      ) {
        throw new Error(
          'Enter start date in YYYY-MM-DD format.',
        );
      }

      const dueDay =
        Number(
          paymentDueDay,
        );

      if (
        !Number.isInteger(
          dueDay,
        ) ||
        dueDay < 1 ||
        dueDay > 31
      ) {
        throw new Error(
          'Payment due day must be between 1 and 31.',
        );
      }

      if (
        endDate.trim() &&
        !isDate(
          endDate.trim(),
        )
      ) {
        throw new Error(
          'Enter end date in YYYY-MM-DD format.',
        );
      }

      if (
        endDate.trim() &&
        endDate.trim() <
          startDate.trim()
      ) {
        throw new Error(
          'End date cannot be earlier than start date.',
        );
      }

      const deposit =
        parseNumber(
          depositAmount,
        );

      if (
        depositAmount.trim() &&
        (
          deposit ===
            undefined ||
          deposit < 0
        )
      ) {
        throw new Error(
          'Enter a valid security deposit amount.',
        );
      }

      return {
        rentAmount:
          rent,

        currency,

        startDate:
          startDate.trim(),

        paymentDueDay:
          dueDay,

        endDate:
          endDate.trim() ||
          undefined,

        depositAmount:
          deposit,

        depositCurrency:
          deposit !==
          undefined
            ? depositCurrency
            : undefined,

        agreementUri,

        autoProlongation,

        openingReadings:
          buildOpeningReadings(),
      };
    };


  const submit =
    async () => {
      if (
        !propertyId
      ) {
        Alert.alert(
          'Dometra',
          'Property is missing.',
        );

        return;
      }

      if (
        !state.workspace
      ) {
        Alert.alert(
          'Dometra',
          'Workspace is not loaded.',
        );

        return;
      }

      setBusy(true);

      try {
        const terms =
          buildTerms();

        if (
          mode === 'MANUAL'
        ) {
          if (
            !tenantProfile
          ) {
            throw new Error(
              'Tenant profile is missing.',
            );
          }

          await createManualTenancy(
            state.workspace.id,
            propertyId,
            tenantProfile,
            terms,
          );

          Alert.alert(
            'Tenant added',
            'The tenant and rental terms have been saved.',
            [
              {
                text:
                  'OK',

                onPress:
                  () => {
                    navigation.popTo(
                      'PropertyDetails',
                      {
                        propertyId,
                      },
                    );
                  },
              },
            ],
          );

          return;
        }

        const invitation =
          await createTenantInvitation(
            state.workspace.id,
            propertyId,
            terms,
          );

        navigation.replace(
          'InviteTenant',
          {
            propertyId,
            invitation,
            terms,
          },
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to save tenancy',
          error instanceof
          Error
            ? error.message
            : 'Unknown error.',
        );
      } finally {
        setBusy(false);
      }
    };


  return (
    <Screen>
      <Header
        title="Rental terms"
        subtitle={
          property?.name ??
          'Apartment'
        }
      />

      <Field
        label="Rental payment *"
        value={
          rentAmount
        }
        onChangeText={
          setRentAmount
        }
        keyboardType="decimal-pad"
        placeholder="500"
        editable={
          !busy
        }
      />

      <Text
        style={
          styles.label
        }
      >
        Currency *
      </Text>

      <View
        style={
          styles.chips
        }
      >
        {currencies.map(
          (
            item,
          ) => (
            <Pressable
              key={
                item
              }
              disabled={
                busy
              }
              onPress={() => {
                setCurrency(
                  item,
                );

                if (
                  !depositAmount.trim()
                ) {
                  setDepositCurrency(
                    item,
                  );
                }
              }}
              style={[
                styles.chip,

                currency ===
                  item &&
                  styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  currency ===
                    item &&
                    styles.chipTextActive,
                ]}
              >
                {
                  item
                }
              </Text>
            </Pressable>
          ),
        )}
      </View>

      <Field
        label="Start date *"
        value={
          startDate
        }
        onChangeText={
          setStartDate
        }
        placeholder="2026-10-01"
        autoCapitalize="none"
        editable={
          !busy
        }
      />

      <Field
        label="Payment due day *"
        value={
          paymentDueDay
        }
        onChangeText={
          setPaymentDueDay
        }
        keyboardType="number-pad"
        placeholder="5"
        editable={
          !busy
        }
      />

      <Field
        label="End date (optional)"
        value={
          endDate
        }
        onChangeText={
          setEndDate
        }
        placeholder="2027-09-30"
        autoCapitalize="none"
        editable={
          !busy
        }
      />

      <Card>
        <View
          style={
            styles.switchRow
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.documentTitle
              }
            >
              Auto-prolongation
            </Text>

            <Text
              style={
                styles.hint
              }
            >
              Keep the tenancy active when the agreement end date is reached.
            </Text>
          </View>

          <Switch
            value={
              autoProlongation
            }
            onValueChange={
              setAutoProlongation
            }
            disabled={
              busy
            }
          />
        </View>

        {!endDate.trim() ? (
          <Text
            style={
              styles.smallHint
            }
          >
            This setting only affects tenancies with an end date.
          </Text>
        ) : null}
      </Card>

      <Field
        label="Security deposit (optional)"
        value={
          depositAmount
        }
        onChangeText={
          setDepositAmount
        }
        keyboardType="decimal-pad"
        editable={
          !busy
        }
      />

      {depositAmount.trim() ? (
        <>
          <Text
            style={
              styles.label
            }
          >
            Deposit currency
          </Text>

          <View
            style={
              styles.chips
            }
          >
            {currencies.map(
              (
                item,
              ) => (
                <Pressable
                  key={
                    item
                  }
                  disabled={
                    busy
                  }
                  onPress={() =>
                    setDepositCurrency(
                      item,
                    )
                  }
                  style={[
                    styles.chip,

                    depositCurrency ===
                      item &&
                      styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,

                      depositCurrency ===
                        item &&
                        styles.chipTextActive,
                    ]}
                  >
                    {
                      item
                    }
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </>
      ) : null}

      {propertyMeters.length >
      0 ? (
        <Card>
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.flex
              }
            >
              <Text
                style={
                  styles.documentTitle
                }
              >
                Opening meter readings
              </Text>

              <Text
                style={
                  styles.hint
                }
              >
                Optional. These values define the tenant's starting meter state.
              </Text>
            </View>

            <SecondaryButton
              title="Use latest"
              onPress={
                useLatestReadings
              }
            />
          </View>

          {propertyMeters.map(
            (
              meter,
            ) => (
              <View
                key={
                  meter.id
                }
                style={
                  styles.meterBlock
                }
              >
                <Text
                  style={
                    styles.meterName
                  }
                >
                  {
                    meter.name
                  }
                </Text>

                {meter.registers.map(
                  (
                    register,
                  ) => (
                    <Field
                      key={
                        register.id
                      }
                      label={
                        meter.registers.length >
                        1
                          ? `${register.code} — ${register.name}`
                          : `${register.name} (${register.unit})`
                      }
                      value={
                        openingValues[
                          register.id
                        ] ??
                        ''
                      }
                      onChangeText={(
                        text,
                      ) =>
                        setOpeningValues(
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
                      placeholder={
                        register.lastValue !==
                        undefined
                          ? `Latest: ${register.lastValue}`
                          : 'Optional'
                      }
                      editable={
                        !busy
                      }
                    />
                  ),
                )}
              </View>
            ),
          )}

          <Text
            style={
              styles.smallHint
            }
          >
            Leave these fields empty if the tenant moves in later and the readings may change.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text
          style={
            styles.documentTitle
          }
        >
          Rental agreement
        </Text>

        <Text
          style={
            styles.hint
          }
        >
          Optional. Add a picture of the signed agreement.
        </Text>

        {agreementUri ? (
          <Image
            source={{
              uri:
                agreementUri,
            }}
            style={
              styles.agreementPhoto
            }
            resizeMode="cover"
          />
        ) : null}

        <View
          style={
            styles.buttonTop
          }
        >
          <SecondaryButton
            title={
              agreementUri
                ? 'Change agreement image'
                : 'Choose agreement image'
            }
            onPress={() =>
              void chooseAgreement()
            }
          />
        </View>
      </Card>

      <PrimaryButton
        title={
          busy
            ? 'Saving...'
            : mode === 'INVITE'
              ? 'Create invitation'
              : 'Save tenant'
        }
        disabled={
          busy
        }
        onPress={() =>
          void submit()
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

    label: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '700',
    },

    chips: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        spacing.sm,
    },

    chip: {
      paddingHorizontal:
        14,

      paddingVertical:
        11,

      borderRadius:
        radius.sm,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surface,
    },

    chipActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    chipText: {
      color:
        colors.text,

      fontWeight:
        '700',
    },

    chipTextActive: {
      color:
        colors.primary,
    },

    switchRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    sectionHeader: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        spacing.md,
    },

    documentTitle: {
      color:
        colors.text,

      fontWeight:
        '800',

      fontSize:
        14,
    },

    hint: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    smallHint: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        spacing.sm,
    },

    meterBlock: {
      marginTop:
        spacing.md,

      gap:
        spacing.sm,
    },

    meterName: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    agreementPhoto: {
      width:
        '100%',

      height:
        180,

      borderRadius:
        radius.sm,

      marginTop:
        spacing.md,

      backgroundColor:
        colors.border,
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },
  });