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
  colors,
  spacing,
} from '../theme';

function formatDate(
  value?: string,
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

function latestMeterText(
  apartment:
    TenantApartmentPortal,
) {
  const values =
    apartment.meters
      .filter(
        (
          meter,
        ) =>
          meter.billingMode ===
          'METERED',
      )
      .flatMap(
        (
          meter,
        ) =>
          meter.registers
            .filter(
              (
                register,
              ) =>
                register.lastValue !==
                undefined,
            )
            .map(
              (
                register,
              ) =>
                `${
                  meter.name
                }${
                  meter.registers.length >
                  1
                    ? ` ${register.code}`
                    : ''
                }: ${register.lastValue} ${register.unit}`,
            ),
      );

  return values.slice(
    0,
    3,
  );
}

export function TenantHomeScreen() {
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
                  'Tenant home',
                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load your apartment.',
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

  return (
    <Screen>
      <Header
        title="Home"
        subtitle="Your rental apartments"
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading apartment...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      apartments.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No active tenancy
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            When you accept an apartment invitation, the rental will appear here.
          </Text>
        </Card>
      ) : null}

      {apartments.map(
        (
          apartment,
        ) => {
          const latest =
            latestMeterText(
              apartment,
            );

          return (
            <React.Fragment
              key={
                apartment.tenancyId
              }
            >
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
                        styles.propertyName
                      }
                    >
                      {
                        apartment.propertyName
                      }
                    </Text>

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
                  </View>

                  <Badge
                    text="Active"
                    tone="success"
                  />
                </View>

                <View
                  style={
                    styles.separator
                  }
                />

                <View
                  style={
                    styles.infoGrid
                  }
                >
                  <View
                    style={
                      styles.infoCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Rent
                    </Text>

                    <Text
                      style={
                        styles.value
                      }
                    >
                      {
                        apartment.rentAmount
                      }{' '}
                      {
                        apartment.currency
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.infoCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Payment due
                    </Text>

                    <Text
                      style={
                        styles.value
                      }
                    >
                      Day{' '}
                      {
                        apartment.paymentDueDay
                      }
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.infoGrid
                  }
                >
                  <View
                    style={
                      styles.infoCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Started
                    </Text>

                    <Text
                      style={
                        styles.valueSmall
                      }
                    >
                      {formatDate(
                        apartment.startDate,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.infoCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      End date
                    </Text>

                    <Text
                      style={
                        styles.valueSmall
                      }
                    >
                      {apartment.endDate
                        ? formatDate(
                            apartment.endDate,
                          )
                        : 'Open-ended'}
                    </Text>
                  </View>
                </View>

                {apartment.depositAmount !==
                undefined ? (
                  <View
                    style={
                      styles.deposit
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Security deposit
                    </Text>

                    <Text
                      style={
                        styles.valueSmall
                      }
                    >
                      {
                        apartment.depositAmount
                      }{' '}
                      {apartment.depositCurrency ??
                        apartment.currency}
                    </Text>
                  </View>
                ) : null}
              </Card>

              <SectionTitle
                title="Meters & services"
              />

              {apartment.meters.length ===
              0 ? (
                <Card>
                  <Text
                    style={
                      styles.muted
                    }
                  >
                    No meters or services have been configured yet.
                  </Text>
                </Card>
              ) : (
                <Card>
                  {apartment.meters.map(
                    (
                      meter,
                      index,
                    ) => (
                      <View
                        key={
                          meter.id
                        }
                      >
                        {index >
                        0 ? (
                          <View
                            style={
                              styles.smallSeparator
                            }
                          />
                        ) : null}

                        <View
                          style={
                            styles.meterRow
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
                                meter.name
                              }
                            </Text>

                            {meter.billingMode ===
                            'FIXED' ? (
                              <Text
                                style={
                                  styles.muted
                                }
                              >
                                {
                                  meter.fixedAmount
                                }{' '}
                                {
                                  meter.billingCurrency
                                }{' '}
                                / month
                              </Text>
                            ) : null}

                            {meter.billingMode ===
                            'VARIABLE' &&
                            meter.lastAmount !==
                            undefined ? (
                              <Text
                                style={
                                  styles.muted
                                }
                              >
                                Last value:{' '}
                                {
                                  meter.lastAmount
                                }{' '}
                                {
                                  meter.billingCurrency
                                }
                              </Text>
                            ) : null}
                          </View>

                          <Badge
                            text={
                              meter.billingMode ===
                              'METERED'
                                ? 'Meter'
                                : meter.billingMode ===
                                    'FIXED'
                                  ? 'Fixed'
                                  : 'Variable'
                            }
                            tone="neutral"
                          />
                        </View>
                      </View>
                    ),
                  )}
                </Card>
              )}

              {latest.length >
              0 ? (
                <>
                  <SectionTitle
                    title="Last readings"
                  />

                  <Card>
                    {latest.map(
                      (
                        text,
                        index,
                      ) => (
                        <Text
                          key={`${text}-${index}`}
                          style={
                            styles.lastReading
                          }
                        >
                          {text}
                        </Text>
                      ),
                    )}
                  </Card>
                </>
              ) : null}

              <SecondaryButton
                title="Open readings"
                onPress={() =>
                  navigation.navigate(
                    'Readings',
                  )
                }
              />
            </React.Fragment>
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
        'flex-start',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    propertyName: {
      color:
        colors.text,

      fontSize:
        20,

      fontWeight:
        '800',
    },

    address: {
      color:
        colors.muted,

      fontSize:
        13,

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

    smallSeparator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.sm,
    },

    infoGrid: {
      flexDirection:
        'row',

      gap:
        spacing.md,

      marginBottom:
        spacing.md,
    },

    infoCell: {
      flex:
        1,
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

    value: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '800',

      marginTop:
        4,
    },

    valueSmall: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',

      marginTop:
        4,
    },

    deposit: {
      marginTop:
        2,
    },

    meterRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    meterName: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    lastReading: {
      color:
        colors.text,

      fontSize:
        13,

      lineHeight:
        22,

      fontWeight:
        '600',
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

    emptyTitle: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },
  });