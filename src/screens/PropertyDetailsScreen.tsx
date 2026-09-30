import React from 'react';

import {
  Alert,
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
  Badge,
  Card,
  Header,
  Money,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  SwipeActions,
} from '../components/SwipeActions';

import {
  useApp,
} from '../context/AppContext';

import {
  Meter,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  iso:
    string,
) {
  const date =
    new Date(
      iso,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
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

function getLatestReading(
  meter:
    Meter,
) {
  const registers =
    meter.registers.filter(
      (
        register,
      ) =>
        register.lastReadingAt &&
        register.currentValue !==
          undefined,
    );

  if (
    registers.length ===
    0
  ) {
    return null;
  }

  const latestTimestamp =
    registers.reduce(
      (
        latest,
        register,
      ) => {
        const timestamp =
          new Date(
            register.lastReadingAt!,
          ).getTime();

        return Math.max(
          latest,
          timestamp,
        );
      },
      0,
    );

  const values =
    registers
      .map(
        (
          register,
        ) => {
          if (
            meter.registers.length >
            1
          ) {
            return `${register.code}: ${register.currentValue} ${register.unit}`;
          }

          return `${register.currentValue} ${register.unit}`;
        },
      )
      .join(
        ' • ',
      );

  return {
    date:
      new Date(
        latestTimestamp,
      ).toISOString(),

    values,
  };
}

export function PropertyDetailsScreen() {
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
    removeMeter,
    generateInvoice,
  } =
    useApp();

  const property =
    state.properties.find(
      (
        item,
      ) =>
        item.id ===
        route.params
          ?.propertyId,
    );

  if (!property) {
    return (
      <Screen>
        <Text>
          Property not found
        </Text>
      </Screen>
    );
  }

  const meters =
    state.meters.filter(
      (
        meter,
      ) =>
        meter.propertyId ===
        property.id,
    );

  const invoices =
    state.invoices.filter(
      (
        invoice,
      ) =>
        invoice.propertyId ===
        property.id,
    );

  const confirmRemoveMeter =
    (
      meterId:
        string,

      meterName:
        string,
    ) => {
      Alert.alert(
        'Remove meter / service?',
        `Are you sure you want to remove "${meterName}"?`,
        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Remove',

            style:
              'destructive',

            onPress:
              () => {
                removeMeter(
                  meterId,
                );
              },
          },
        ],
      );
    };

  const createInvoice =
    () => {
      const invoice =
        generateInvoice(
          property.id,
        );

      Alert.alert(
        t(
          'invoiceCreated',
        ),
      );

      navigation.navigate(
        'InvoiceDetails',
        {
          invoiceId:
            invoice.id,
        },
      );
    };

  return (
    <Screen>
      <Header
        title={
          property.name
        }
        subtitle={`${property.address}, ${property.city}`}
        right={
          <Badge
            text={
              property.tenantName
                ? t(
                    'occupied',
                  )
                : t(
                    'vacant',
                  )
            }
            tone={
              property.tenantName
                ? 'success'
                : 'neutral'
            }
          />
        }
      />

      <Card>
        <View
          style={
            styles.infoGrid
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.label
              }
            >
              {t(
                'tenantLabel',
              )}
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {property.tenantName ??
                '—'}
            </Text>
          </View>

          {property.areaM2 >
          0 ? (
            <View
              style={
                styles.alignRight
              }
            >
              <Text
                style={
                  styles.label
                }
              >
                Square
              </Text>

              <Text
                style={
                  styles.value
                }
              >
                {
                  property.areaM2
                }{' '}
                m²
              </Text>
            </View>
          ) : null}

          {property.rentAmount >
          0 ? (
            <View
              style={
                styles.alignRight
              }
            >
              <Text
                style={
                  styles.label
                }
              >
                {t(
                  'rent',
                )}
              </Text>

              <Money
                amount={
                  property.rentAmount
                }
                currency={
                  property.rentCurrency
                }
                strong
              />
            </View>
          ) : null}
        </View>
      </Card>

      <SectionTitle
        title="Meters & services"
      />

      {meters.map(
        (
          meter,
        ) => {
          const billingMode =
            meter.billingMode ??
            'METERED';

          const latestReading =
            getLatestReading(
              meter,
            );

          return (
            <SwipeActions
              key={
                meter.id
              }
              onEdit={() =>
                navigation.navigate(
                  'AddMeter',
                  {
                    propertyId:
                      property.id,

                    meterId:
                      meter.id,
                  },
                )
              }
              onRemove={() =>
                confirmRemoveMeter(
                  meter.id,
                  meter.name,
                )
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
                        styles.value
                      }
                    >
                      {
                        meter.name
                      }
                    </Text>

                    {billingMode ===
                    'METERED' ? (
                      <>
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          {meter.registers
                            .map(
                              (
                                register,
                              ) =>
                                `${register.tariff} ${register.tariffCurrency}/${register.unit}`,
                            )
                            .join(
                              ' • ',
                            )}
                        </Text>

                        {latestReading ? (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Badge
                              text={`Last ${formatDate(
                                latestReading.date,
                              )}`}
                              tone="success"
                            />

                            <Text
                              style={
                                styles.lastReadingValue
                              }
                            >
                              {
                                latestReading.values
                              }
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Badge
                              text="No readings yet"
                              tone="neutral"
                            />
                          </View>
                        )}
                      </>
                    ) : null}

                    {billingMode ===
                    'FIXED' ? (
                      <Text
                        style={
                          styles.muted
                        }
                      >
                        Fixed •{' '}
                        {
                          meter.fixedAmount
                        }{' '}
                        {meter.billingCurrency ??
                          'UAH'}{' '}
                        / month
                      </Text>
                    ) : null}

                    {billingMode ===
                    'VARIABLE' ? (
                      <>
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          Variable service
                        </Text>

                        {meter.currentAmount !==
                        undefined ? (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            {meter.lastAmountAt ? (
                              <Badge
                                text={`Last ${formatDate(
                                  meter.lastAmountAt,
                                )}`}
                                tone="success"
                              />
                            ) : null}

                            <Text
                              style={
                                styles.lastReadingValue
                              }
                            >
                              {
                                meter.currentAmount
                              }{' '}
                              {meter.billingCurrency ??
                                'UAH'}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Badge
                              text="No value yet"
                              tone="neutral"
                            />
                          </View>
                        )}
                      </>
                    ) : null}
                  </View>

                  {billingMode ===
                  'METERED' ? (
                    <SecondaryButton
                      title="Reading"
                      onPress={() =>
                        navigation.navigate(
                          'MeterReading',
                          {
                            meterId:
                              meter.id,
                          },
                        )
                      }
                    />
                  ) : null}

                  {billingMode ===
                  'VARIABLE' ? (
                    <SecondaryButton
                      title="Enter value"
                      onPress={() =>
                        navigation.navigate(
                          'MeterReading',
                          {
                            meterId:
                              meter.id,
                          },
                        )
                      }
                    />
                  ) : null}
                </View>
              </Card>
            </SwipeActions>
          );
        },
      )}

      <SecondaryButton
        title="+ Add meter / service"
        onPress={() =>
          navigation.navigate(
            'AddMeter',
            {
              propertyId:
                property.id,
            },
          )
        }
      />

      <SectionTitle
        title={
          t(
            'invoices',
          )
        }
      />

      {invoices
        .slice(
          0,
          3,
        )
        .map(
          (
            invoice,
          ) => (
            <Card
              key={
                invoice.id
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
                      styles.value
                    }
                  >
                    {
                      invoice.period
                    }
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {
                      invoice.status
                    }
                  </Text>
                </View>

                <SecondaryButton
                  title={
                    t(
                      'invoice',
                    )
                  }
                  onPress={() =>
                    navigation.navigate(
                      'InvoiceDetails',
                      {
                        invoiceId:
                          invoice.id,
                      },
                    )
                  }
                />
              </View>
            </Card>
          ),
        )}

      <PrimaryButton
        title={
          t(
            'generateInvoice',
          )
        }
        onPress={
          createInvoice
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    rowBetween: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    infoGrid: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    flex: {
      flex:
        1,
    },

    alignRight: {
      alignItems:
        'flex-end',
    },

    label: {
      color:
        colors.muted,

      fontSize:
        12,
    },

    value: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '700',

      marginTop:
        4,
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

    lastReading: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      alignItems:
        'center',

      gap:
        8,

      marginTop:
        10,
    },

    lastReadingValue: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '700',
    },
  });