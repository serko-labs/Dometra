import React, {
  useCallback,
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
} from '@react-navigation/native';

import {
  Badge,
  Card,
  Header,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  loadTenantApartments,
  TenantApartmentPortal,
} from '../services/tenantPortalRepository';

import {
  Meter,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  value?: string,
) {
  if (
    !value
  ) {
    return '';
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

function lastReadingText(
  meter:
    Meter,
) {
  const values =
    meter.registers
      .filter(
        register =>
          register.lastValue !==
          undefined,
      )
      .map(
        register =>
          meter.registers.length >
          1
            ? `${register.code}: ${register.lastValue} ${register.unit}`
            : `${register.lastValue} ${register.unit}`,
      );

  return values.join(
    ' • ',
  );
}

function lastReadingDate(
  meter:
    Meter,
) {
  const dates =
    meter.registers
      .map(
        register =>
          register.lastReadingAt,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      );

  if (
    dates.length ===
    0
  ) {
    return undefined;
  }

  return dates
    .sort()
    .reverse()[0];
}

export function ReadingsScreen() {
  const navigation =
    useNavigation<any>();

  const [
    apartments,
    setApartments,
  ] =
    useState<
      TenantApartmentPortal[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useFocusEffect(
    useCallback(
      () => {
        let active =
          true;

        const load =
          async () => {
            setLoading(
              true,
            );

            try {
              const data =
                await loadTenantApartments();

              if (
                active
              ) {
                setApartments(
                  data,
                );
              }
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  'Readings',
                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load meters.',
                );
              }
            } finally {
              if (
                active
              ) {
                setLoading(
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
      [],
    ),
  );

  const openReading =
    (
      meterId:
        string,
    ) => {
      navigation
        .getParent()
        ?.navigate(
          'MeterReading',
          {
            meterId,

            source:
              'TENANT',
          },
        );
    };

  return (
    <Screen>
      <Header
        title="Readings"
        subtitle="Submit utility meter values"
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading meters...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      apartments.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.title
            }
          >
            No active tenancy
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Meter readings become available after you join an apartment.
          </Text>
        </Card>
      ) : null}

      {apartments.map(
        apartment => {
          const meters =
            apartment.meters.filter(
              meter =>
                meter.billingMode ===
                'METERED',
            );

          const checkoutPending =
            apartment.status ===
            'CHECKOUT_PENDING';

          return (
            <View
              key={
                apartment.tenancyId
              }
            >
              <SectionTitle
                title={
                  apartment.propertyName
                }
              />

              <Text
                style={
                  styles.address
                }
              >
                {
                  apartment.propertyAddress
                },{' '}
                {
                  apartment.propertyCity
                }
              </Text>

              {checkoutPending ? (
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
                        Checkout required
                      </Text>

                      <Text
                        style={
                          styles.muted
                        }
                      >
                        This rental is waiting for checkout. Regular monthly readings are disabled.
                      </Text>
                    </View>

                    <Badge
                      text="Pending"
                      tone="warning"
                    />
                  </View>
                </Card>
              ) : null}

              {meters.length ===
              0 ? (
                <Card>
                  <Text
                    style={
                      styles.muted
                    }
                  >
                    No utility meters are configured for this apartment.
                  </Text>
                </Card>
              ) : null}

              {meters.map(
                meter => {
                  const last =
                    lastReadingText(
                      meter,
                    );

                  const date =
                    lastReadingDate(
                      meter,
                    );

                  return (
                    <Card
                      key={
                        meter.id
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
                              meter.name
                            }
                          </Text>

                          <Text
                            style={
                              styles.tariff
                            }
                          >
                            {meter.registers
                              .map(
                                register =>
                                  `${register.tariff} ${register.tariffCurrency}/${register.unit}`,
                              )
                              .join(
                                ' • ',
                              )}
                          </Text>
                        </View>

                        <Badge
                          text={
                            meter.registers.length >
                            1
                              ? `${meter.registers.length} tariffs`
                              : 'Meter'
                          }
                          tone="neutral"
                        />
                      </View>

                      <View
                        style={
                          styles.separator
                        }
                      />

                      {last ? (
                        <>
                          <Text
                            style={
                              styles.label
                            }
                          >
                            Last reading
                          </Text>

                          <Text
                            style={
                              styles.lastValue
                            }
                          >
                            {last}
                          </Text>

                          {date ? (
                            <Text
                              style={
                                styles.muted
                              }
                            >
                              {formatDate(
                                date,
                              )}
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          No readings yet.
                        </Text>
                      )}

                      {!checkoutPending ? (
                        <View
                          style={
                            styles.buttonTop
                          }
                        >
                          <SecondaryButton
                            title="Add reading"
                            onPress={() =>
                              openReading(
                                meter.id,
                              )
                            }
                          />
                        </View>
                      ) : null}
                    </Card>
                  );
                },
              )}
            </View>
          );
        },
      )}
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

    address: {
      color:
        colors.muted,

      fontSize:
        12,

      marginBottom:
        spacing.sm,

      marginTop:
        -4,
    },

    tariff: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    label: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    lastValue: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',

      marginTop:
        5,
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

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },
  });