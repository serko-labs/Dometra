import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
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
} from '../components/ui';

import {
  CheckoutReading,
  loadCheckoutReadings,
  loadTenancyCheckout,
  saveTenantCheckoutReadings,
  TenancyCheckout,
} from '../services/checkoutRepository';

import {
  loadTenantApartments,
  TenantApartmentPortal,
} from '../services/tenantPortalRepository';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  value?:
    string,
) {
  if (
    !value
  ) {
    return '—';
  }

  const date =
    new Date(
      `${value}T00:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,

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

export function TenantCheckoutScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    t,
  } =
    useTranslation();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const [
    apartment,
    setApartment,
  ] =
    useState<
      TenantApartmentPortal | null
    >(null);

  const [
    checkout,
    setCheckout,
  ] =
    useState<
      TenancyCheckout | null
    >(null);

  const [
    savedReadings,
    setSavedReadings,
  ] =
    useState<
      CheckoutReading[]
    >([]);

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
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const apartments =
            await loadTenantApartments();

          const selected =
            apartments.find(
              item =>
                item.tenancyId ===
                tenancyId,
            ) ??
            null;

          const [
            checkoutData,
            readings,
          ] =
            await Promise.all([
              loadTenancyCheckout(
                tenancyId,
              ),

              loadCheckoutReadings(
                tenancyId,
              ),
            ]);

          setApartment(
            selected,
          );

          setCheckout(
            checkoutData,
          );

          setSavedReadings(
            readings,
          );

          const values:
            Record<
              string,
              string
            > = {};

          for (
            const reading
            of readings
          ) {
            values[
              reading.meterRegisterId
            ] =
              String(
                reading.value,
              );
          }

          setDraftValues(
            values,
          );
        } catch (
          error
        ) {
          Alert.alert(
            t(
              'checkout',

              {
                defaultValue:
                  'Checkout',
              },
            ),

            error instanceof
            Error
              ? error.message
              : 'Unable to load checkout.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        tenancyId,
        t,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void load();
      },

      [
        load,
      ],
    ),
  );

  const requiredRegisters =
    useMemo(
      () =>
        apartment?.meters
          .filter(
            meter =>
              meter.billingMode ===
              'METERED',
          )
          .flatMap(
            meter =>
              meter.registers.map(
                register => ({
                  meterId:
                    meter.id,

                  meterName:
                    meter.name,

                  register,

                  registerCount:
                    meter.registers.length,
                }),
              ),
          ) ??
        [],

      [
        apartment,
      ],
    );

  const save =
    async () => {
      if (
        !apartment ||
        !checkout ||
        checkout.status !==
          'PENDING'
      ) {
        return;
      }

      try {
        const readings =
          requiredRegisters.map(
            item => {
              const raw =
                (
                  draftValues[
                    item.register.id
                  ] ??
                  ''
                )
                  .trim()
                  .replace(
                    ',',
                    '.',
                  );

              const value =
                Number(
                  raw,
                );

              if (
                !raw ||
                !Number.isFinite(
                  value,
                )
              ) {
                throw new Error(
                  `Enter a valid value for ${item.meterName} ${item.register.code}.`,
                );
              }

              const previous =
                item.register.lastValue ??
                item.register.previousValue ??
                0;

              if (
                value <
                previous
              ) {
                throw new Error(
                  `${item.meterName} ${item.register.code} cannot be lower than the previous value (${previous}).`,
                );
              }

              return {
                registerId:
                  item.register.id,

                value,
              };
            },
          );

        setBusy(
          true,
        );

        await saveTenantCheckoutReadings(
          {
            tenancyId,

            readingDate:
              checkout.checkoutDate,

            readings,
          },
        );

        Alert.alert(
          'Final readings submitted',
          'Your landlord can now review the readings and complete the checkout.',

          [
            {
              text:
                'OK',

              onPress:
                () => {
                  if (
                    navigation.canGoBack()
                  ) {
                    navigation.goBack();
                  }
                },
            },
          ],
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to submit readings',

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
    loading
  ) {
    return (
      <Screen>
        <Header
          title="Final readings"
          subtitle="Loading checkout..."
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading...
          </Text>
        </Card>
      </Screen>
    );
  }

  if (
    !apartment ||
    !checkout ||
    checkout.status !==
      'PENDING'
  ) {
    return (
      <Screen>
        <Header
          title="Final readings"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            No pending checkout
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Final readings are available only after the landlord starts checkout.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Final readings"
        subtitle={`${apartment.propertyName} · ${formatDate(
          checkout.checkoutDate,
        )}`}
      />

      <Card>
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
              Move-out checkout
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              Submit the final value for every meter register. These values are separate from regular monthly readings.
            </Text>
          </View>

          <Badge
            text="Required"
            tone="warning"
          />
        </View>
      </Card>

      {requiredRegisters.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.title
            }
          >
            No final meter readings required
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            This apartment has no active metered services. The landlord can complete checkout directly.
          </Text>
        </Card>
      ) : null}

      {requiredRegisters.map(
        item => {
          const previous =
            item.register.lastValue ??
            item.register.previousValue ??
            0;

          const wasSubmitted =
            savedReadings.some(
              reading =>
                reading.meterRegisterId ===
                item.register.id,
            );

          return (
            <Card
              key={
                item.register.id
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
                      styles.meterName
                    }
                  >
                    {
                      item.meterName
                    }
                  </Text>

                  {item.registerCount >
                  1 ? (
                    <Text
                      style={
                        styles.registerName
                      }
                    >
                      {
                        item.register.code
                      }{' '}
                      ·{' '}
                      {
                        item.register.name
                      }
                    </Text>
                  ) : null}
                </View>

                {wasSubmitted ? (
                  <Badge
                    text="Submitted"
                    tone="success"
                  />
                ) : null}
              </View>

              <View
                style={
                  styles.previousBox
                }
              >
                <Text
                  style={
                    styles.previousLabel
                  }
                >
                  Previous value
                </Text>

                <Text
                  style={
                    styles.previousValue
                  }
                >
                  {previous}{' '}
                  {
                    item.register.unit
                  }
                </Text>
              </View>

              <Field
                label="Final reading *"
                value={
                  draftValues[
                    item.register.id
                  ] ??
                  ''
                }
                onChangeText={
                  value =>
                    setDraftValues(
                      current => ({
                        ...current,

                        [item.register.id]:
                          value,
                      }),
                    )
                }
                keyboardType="decimal-pad"
                placeholder={`≥ ${previous}`}
                editable={
                  !busy
                }
              />
            </Card>
          );
        },
      )}

      {requiredRegisters.length >
      0 ? (
        <PrimaryButton
          title={
            busy
              ? 'Submitting...'
              : 'Submit final readings'
          }
          disabled={
            busy
          }
          onPress={() =>
            void save()
          }
        />
      ) : null}
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
        'flex-start',

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

    meterName: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    registerName: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        3,
    },

    previousBox: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,

      marginBottom:
        spacing.md,
    },

    previousLabel: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    previousValue: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',

      marginTop:
        4,
    },
  });