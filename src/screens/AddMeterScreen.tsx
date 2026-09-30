import React, {
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  useTranslation,
} from 'react-i18next';

import {
  Field,
  Header,
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  colors,
  radius,
  spacing,
} from '../theme';

import {
  CurrencyCode,
  Meter,
  MeterBillingMode,
} from '../types';

const categories: Array<{
  value:
    Meter['category'];

  label:
    string;
}> = [
  {
    value:
      'ELECTRICITY',

    label:
      'Electricity',
  },

  {
    value:
      'WATER',

    label:
      'Water',
  },

  {
    value:
      'GAS',

    label:
      'Gas',
  },

  {
    value:
      'CUSTOM',

    label:
      'Custom',
  },
];

const currencies:
  CurrencyCode[] = [
  'UAH',
  'USD',
  'EUR',
];

function numberText(
  value:
    number |
    undefined,
) {
  return value !==
    undefined
    ? String(value)
    : '';
}

export function AddMeterScreen() {
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
    addMeter,
    editMeter,
  } =
    useApp();

  const propertyId =
    route.params
      ?.propertyId as
      string;

  const meterId =
    route.params
      ?.meterId as
      | string
      | undefined;

  const existing =
    meterId
      ? state.meters.find(
          (
            meter,
          ) =>
            meter.id ===
            meterId,
        )
      : undefined;

  const isEditing =
    Boolean(
      existing,
    );

  const initialDual =
    Boolean(
      existing
        ?.registers.find(
          (
            register,
          ) =>
            register.code ===
            'T1',
        ),
    );

  const [
    category,
    setCategory,
  ] =
    useState<
      Meter['category']
    >(
      existing?.category ??
      'ELECTRICITY',
    );

  const [
    dualTariff,
    setDualTariff,
  ] =
    useState(
      initialDual,
    );

  const [
    tariff,
    setTariff,
  ] =
    useState(
      !initialDual
        ? numberText(
            existing
              ?.registers[0]
              ?.tariff,
          )
        : '',
    );

  const [
    tariffT1,
    setTariffT1,
  ] =
    useState(
      numberText(
        existing
          ?.registers.find(
            (
              register,
            ) =>
              register.code ===
              'T1',
          )
          ?.tariff,
      ),
    );

  const [
    tariffT2,
    setTariffT2,
  ] =
    useState(
      numberText(
        existing
          ?.registers.find(
            (
              register,
            ) =>
              register.code ===
              'T2',
          )
          ?.tariff,
      ),
    );

  const [
    tariffCurrency,
    setTariffCurrency,
  ] =
    useState<CurrencyCode>(
      existing
        ?.registers[0]
        ?.tariffCurrency ??
      existing
        ?.billingCurrency ??
      'UAH',
    );

  const [
    customName,
    setCustomName,
  ] =
    useState(
      existing
        ?.category ===
        'CUSTOM'
        ? existing.name
        : '',
    );

  const [
    billingMode,
    setBillingMode,
  ] =
    useState<
      MeterBillingMode
    >(
      existing
        ?.category ===
        'CUSTOM'
        ? existing.billingMode
        : 'FIXED',
    );

  const [
    fixedAmount,
    setFixedAmount,
  ] =
    useState(
      numberText(
        existing
          ?.fixedAmount,
      ),
    );

  const [
    customCurrency,
    setCustomCurrency,
  ] =
    useState<CurrencyCode>(
      existing
        ?.billingCurrency ??
      'UAH',
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const parseAmount =
    (
      value:
        string,
    ) => {
      if (
        !value.trim()
      ) {
        return NaN;
      }

      return Number(
        value
          .trim()
          .replace(
            ',',
            '.',
          ),
      );
    };

  const clearTariffs =
    () => {
      setTariff('');
      setTariffT1('');
      setTariffT2('');
    };

  const returnToProperty =
    () => {
      navigation.popTo(
        'PropertyDetails',

        {
          propertyId,
        },
      );
    };

  const selectCategory =
    (
      next:
        Meter['category'],
    ) => {
      if (
        next ===
        category
      ) {
        return;
      }

      setCategory(
        next,
      );

      setDualTariff(
        false,
      );

      clearTariffs();

      if (
        next !==
        'CUSTOM'
      ) {
        setCustomName('');

        setFixedAmount('');

        setBillingMode(
          'FIXED',
        );
      }
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

      setBusy(
        true,
      );

      try {
        /*
         * CUSTOM
         */
        if (
          category ===
          'CUSTOM'
        ) {
          if (
            !customName.trim()
          ) {
            throw new Error(
              'Enter a name for the custom service.',
            );
          }

          let amount:
            number | undefined;

          if (
            billingMode ===
            'FIXED'
          ) {
            amount =
              parseAmount(
                fixedAmount,
              );

            if (
              !Number.isFinite(
                amount,
              ) ||
              amount < 0
            ) {
              throw new Error(
                'Enter a valid fixed monthly amount.',
              );
            }
          }

          const input = {
            propertyId,

            category:
              'CUSTOM' as const,

            name:
              customName.trim(),

            billingMode,

            fixedAmount:
              amount,

            billingCurrency:
              customCurrency,
          };

          if (
            existing
          ) {
            await editMeter(
              existing.id,
              input,
            );
          } else {
            await addMeter(
              input,
            );
          }

          returnToProperty();

          return;
        }

        /*
         * METERED
         */

        const unit =
          category ===
          'ELECTRICITY'
            ? 'kWh'
            : 'm³';

        let normalTariff:
          number | undefined;

        let t1:
          number | undefined;

        let t2:
          number | undefined;

        if (
          category ===
            'ELECTRICITY' &&
          dualTariff
        ) {
          t1 =
            parseAmount(
              tariffT1,
            );

          t2 =
            parseAmount(
              tariffT2,
            );

          if (
            !Number.isFinite(
              t1,
            ) ||
            t1 < 0
          ) {
            throw new Error(
              'Enter a valid T1 price per kWh.',
            );
          }

          if (
            !Number.isFinite(
              t2,
            ) ||
            t2 < 0
          ) {
            throw new Error(
              'Enter a valid T2 price per kWh.',
            );
          }
        } else {
          normalTariff =
            parseAmount(
              tariff,
            );

          if (
            !Number.isFinite(
              normalTariff,
            ) ||
            normalTariff < 0
          ) {
            throw new Error(
              `Enter a valid price per ${unit}.`,
            );
          }
        }

        const input = {
          propertyId,

          category,

          dualTariff:
            category ===
              'ELECTRICITY' &&
            dualTariff,

          billingMode:
            'METERED' as const,

          tariff:
            normalTariff,

          tariffT1:
            t1,

          tariffT2:
            t2,

          tariffCurrency,
        };

        /*
         * EDIT:
         *
         * Editing meter settings does NOT
         * automatically ask for a new reading.
         */
        if (
          existing
        ) {
          await editMeter(
            existing.id,
            input,
          );

          returnToProperty();

          return;
        }

        /*
         * CREATE:
         *
         * Replace AddMeter with MeterReading.
         *
         * Stack becomes:
         *
         * Home
         * PropertyDetails
         * MeterReading
         *
         * AddMeter is gone.
         */
        const created =
          await addMeter(
            input,
          );

        navigation.replace(
          'MeterReading',

          {
            meterId:
              created.id,
          },
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to save meter / service',

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

  const priceUnit =
    category ===
    'ELECTRICITY'
      ? 'kWh'
      : 'm³';

  return (
    <Screen>
      <Header
        title={
          isEditing
            ? 'Edit meter / service'
            : t(
                'addMeter',
              )
        }
        subtitle={
          isEditing
            ? 'Update meter or service settings'
            : 'Add a utility meter or monthly service'
        }
      />

      <Text
        style={
          styles.label
        }
      >
        Type
      </Text>

      <View
        style={
          styles.chips
        }
      >
        {categories.map(
          (
            item,
          ) => (
            <Pressable
              key={
                item.value
              }
              disabled={
                busy
              }
              onPress={() =>
                selectCategory(
                  item.value,
                )
              }
              style={[
                styles.chip,

                category ===
                  item.value &&
                  styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  category ===
                    item.value &&
                    styles.chipTextActive,
                ]}
              >
                {
                  item.label
                }
              </Text>
            </Pressable>
          ),
        )}
      </View>

      {category ===
      'ELECTRICITY' ? (
        <>
          <Text
            style={
              styles.label
            }
          >
            Tariff type
          </Text>

          <View
            style={
              styles.chips
            }
          >
            <Pressable
              disabled={
                busy
              }
              onPress={() => {
                if (
                  dualTariff
                ) {
                  setDualTariff(
                    false,
                  );

                  clearTariffs();
                }
              }}
              style={[
                styles.chip,

                !dualTariff &&
                  styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  !dualTariff &&
                    styles.chipTextActive,
                ]}
              >
                Single tariff
              </Text>
            </Pressable>

            <Pressable
              disabled={
                busy
              }
              onPress={() => {
                if (
                  !dualTariff
                ) {
                  setDualTariff(
                    true,
                  );

                  clearTariffs();
                }
              }}
              style={[
                styles.chip,

                dualTariff &&
                  styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  dualTariff &&
                    styles.chipTextActive,
                ]}
              >
                Double tariff
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {category !==
        'CUSTOM' &&
      !(
        category ===
          'ELECTRICITY' &&
        dualTariff
      ) ? (
        <Field
          label={`Price per ${priceUnit} *`}
          value={
            tariff
          }
          onChangeText={
            setTariff
          }
          placeholder="0.00"
          keyboardType="decimal-pad"
          editable={
            !busy
          }
        />
      ) : null}

      {category ===
        'ELECTRICITY' &&
      dualTariff ? (
        <>
          <Field
            label="T1 price per kWh *"
            value={
              tariffT1
            }
            onChangeText={
              setTariffT1
            }
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={
              !busy
            }
          />

          <Field
            label="T2 price per kWh *"
            value={
              tariffT2
            }
            onChangeText={
              setTariffT2
            }
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={
              !busy
            }
          />
        </>
      ) : null}

      {category !==
      'CUSTOM' ? (
        <>
          <Text
            style={
              styles.label
            }
          >
            Tariff currency
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
                    setTariffCurrency(
                      item,
                    )
                  }
                  style={[
                    styles.chip,

                    tariffCurrency ===
                      item &&
                      styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,

                      tariffCurrency ===
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

      {category ===
      'CUSTOM' ? (
        <>
          <Field
            label="Name *"
            value={
              customName
            }
            onChangeText={
              setCustomName
            }
            placeholder="Internet, Security, Central heating..."
            editable={
              !busy
            }
          />

          <Text
            style={
              styles.label
            }
          >
            Billing type
          </Text>

          <View
            style={
              styles.chips
            }
          >
            <Pressable
              disabled={
                busy
              }
              onPress={() =>
                setBillingMode(
                  'FIXED',
                )
              }
              style={[
                styles.chip,

                billingMode ===
                  'FIXED' &&
                  styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  billingMode ===
                    'FIXED' &&
                    styles.chipTextActive,
                ]}
              >
                Fixed
              </Text>
            </Pressable>

            <Pressable
              disabled={
                busy
              }
              onPress={() =>
                setBillingMode(
                  'VARIABLE',
                )
              }
              style={[
                styles.chip,

                billingMode ===
                  'VARIABLE' &&
                  styles.chipActive,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  billingMode ===
                    'VARIABLE' &&
                    styles.chipTextActive,
                ]}
              >
                Variable
              </Text>
            </Pressable>
          </View>

          {billingMode ===
          'FIXED' ? (
            <Field
              label="Monthly amount *"
              value={
                fixedAmount
              }
              onChangeText={
                setFixedAmount
              }
              placeholder="350"
              keyboardType="decimal-pad"
              editable={
                !busy
              }
            />
          ) : null}

          <Text
            style={
              styles.label
            }
          >
            Currency
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
                    setCustomCurrency(
                      item,
                    )
                  }
                  style={[
                    styles.chip,

                    customCurrency ===
                      item &&
                      styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,

                      customCurrency ===
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

      <PrimaryButton
        title={
          busy
            ? 'Saving...'
            : isEditing
              ? 'Save'
              : t(
                  'create',
                )
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
    label: {
      color:
        colors.text,

      fontWeight:
        '700',

      fontSize:
        13,
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

      backgroundColor:
        colors.surface,

      borderWidth:
        1,

      borderColor:
        colors.border,
    },

    chipActive: {
      backgroundColor:
        colors.primarySoft,

      borderColor:
        colors.primary,
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
  });