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

  const existingMeter =
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
      existingMeter,
    );

  const initialCategory:
    Meter['category'] =
    existingMeter?.category ===
    'HEAT'
      ? 'CUSTOM'
      : existingMeter
          ?.category ??
        'ELECTRICITY';

  const initialDualTariff =
    existingMeter
      ?.category ===
      'ELECTRICITY' &&
    Boolean(
      existingMeter.registers.find(
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
      initialCategory,
    );

  const [
    dualTariff,
    setDualTariff,
  ] =
    useState(
      initialDualTariff,
    );

  const [
    tariff,
    setTariff,
  ] =
    useState(
      !initialDualTariff
        ? existingMeter
            ?.registers[0]
            ?.tariff !==
          undefined
          ? String(
              existingMeter
                .registers[0]
                .tariff,
            )
          : ''
        : '',
    );

  const [
    tariffT1,
    setTariffT1,
  ] =
    useState(
      existingMeter
        ?.registers.find(
          (
            register,
          ) =>
            register.code ===
            'T1',
        )
        ?.tariff !==
      undefined
        ? String(
            existingMeter
              .registers.find(
                (
                  register,
                ) =>
                  register.code ===
                  'T1',
              )!
              .tariff,
          )
        : '',
    );

  const [
    tariffT2,
    setTariffT2,
  ] =
    useState(
      existingMeter
        ?.registers.find(
          (
            register,
          ) =>
            register.code ===
            'T2',
        )
        ?.tariff !==
      undefined
        ? String(
            existingMeter
              .registers.find(
                (
                  register,
                ) =>
                  register.code ===
                  'T2',
              )!
              .tariff,
          )
        : '',
    );

  const [
    tariffCurrency,
    setTariffCurrency,
  ] =
    useState<CurrencyCode>(
      existingMeter
        ?.registers[0]
        ?.tariffCurrency ??
        'UAH',
    );

  const [
    customName,
    setCustomName,
  ] =
    useState(
      existingMeter
        ?.category ===
        'CUSTOM'
        ? existingMeter.name
        : '',
    );

  const [
    billingMode,
    setBillingMode,
  ] =
    useState<
      MeterBillingMode
    >(
      existingMeter
        ?.category ===
        'CUSTOM'
        ? existingMeter
            .billingMode
        : 'FIXED',
    );

  const [
    fixedAmount,
    setFixedAmount,
  ] =
    useState(
      existingMeter
        ?.fixedAmount !==
      undefined
        ? String(
            existingMeter.fixedAmount,
          )
        : '',
    );

  const [
    customCurrency,
    setCustomCurrency,
  ] =
    useState<CurrencyCode>(
      existingMeter
        ?.billingCurrency ??
        'UAH',
    );

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

  const selectCategory =
    (
      nextCategory:
        Meter['category'],
    ) => {
      if (
        nextCategory ===
        category
      ) {
        return;
      }

      setCategory(
        nextCategory,
      );

      setDualTariff(
        false,
      );

      clearTariffs();

      if (
        nextCategory !==
        'CUSTOM'
      ) {
        setCustomName('');

        setBillingMode(
          'FIXED',
        );

        setFixedAmount('');
      }
    };

  const validateTariffs =
    () => {
      if (
        category ===
        'CUSTOM'
      ) {
        return true;
      }

      if (
        category ===
          'ELECTRICITY' &&
        dualTariff
      ) {
        const t1 =
          parseAmount(
            tariffT1,
          );

        const t2 =
          parseAmount(
            tariffT2,
          );

        if (
          !Number.isFinite(
            t1,
          ) ||
          t1 < 0
        ) {
          Alert.alert(
            'Dometra',
            'Enter a valid T1 price per kWh.',
          );

          return false;
        }

        if (
          !Number.isFinite(
            t2,
          ) ||
          t2 < 0
        ) {
          Alert.alert(
            'Dometra',
            'Enter a valid T2 price per kWh.',
          );

          return false;
        }

        return true;
      }

      const price =
        parseAmount(
          tariff,
        );

      if (
        !Number.isFinite(
          price,
        ) ||
        price < 0
      ) {
        Alert.alert(
          'Dometra',
          `Enter a valid price per ${
            category ===
            'ELECTRICITY'
              ? 'kWh'
              : 'm³'
          }.`,
        );

        return false;
      }

      return true;
    };

  const submit = () => {
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
      category ===
      'CUSTOM'
    ) {
      if (
        !customName.trim()
      ) {
        Alert.alert(
          'Dometra',
          'Enter a name for the custom service.',
        );

        return;
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
          Alert.alert(
            'Dometra',
            'Enter a valid fixed monthly amount.',
          );

          return;
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
        existingMeter
      ) {
        editMeter(
          existingMeter.id,
          input,
        );

        navigation.goBack();

        return;
      }

      addMeter(
        input,
      );

      navigation.replace(
        'PropertyDetails',
        {
          propertyId,
        },
      );

      return;
    }

    if (
      !validateTariffs()
    ) {
      return;
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
        !(
          category ===
            'ELECTRICITY' &&
          dualTariff
        )
          ? parseAmount(
              tariff,
            )
          : undefined,

      tariffT1:
        category ===
          'ELECTRICITY' &&
        dualTariff
          ? parseAmount(
              tariffT1,
            )
          : undefined,

      tariffT2:
        category ===
          'ELECTRICITY' &&
        dualTariff
          ? parseAmount(
              tariffT2,
            )
          : undefined,

      tariffCurrency,
    };

    if (
      existingMeter
    ) {
      editMeter(
        existingMeter.id,
        input,
      );

      navigation.goBack();

      return;
    }

    const meter =
      addMeter(
        input,
      );

    navigation.replace(
      'MeterReading',
      {
        meterId:
          meter.id,
      },
    );
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

          <Text
            style={
              styles.hint
            }
          >
            {billingMode ===
            'FIXED'
              ? 'The same amount will be used every billing period.'
              : 'A new amount will be entered for every billing period.'}
          </Text>
        </>
      ) : null}

      <PrimaryButton
        title={
          isEditing
            ? 'Save'
            : t(
                'create',
              )
        }
        onPress={
          submit
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

    hint: {
      color:
        colors.muted,

      fontSize:
        13,

      lineHeight:
        19,
    },
  });