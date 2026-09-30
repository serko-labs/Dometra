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
  loadPropertyHistory,
  PropertyHistoryItem,
} from '../services/propertyHistoryService';

import {
  Meter,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatReadingDate(
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

function formatHistoryDate(
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

  return date.toLocaleString(
    undefined,
    {
      day:
        '2-digit',

      month:
        'short',

      hour:
        '2-digit',

      minute:
        '2-digit',
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
        register.lastValue !==
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
            return `${register.code}: ${register.lastValue} ${register.unit}`;
          }

          return `${register.lastValue} ${register.unit}`;
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

function historyTone(
  category:
    PropertyHistoryItem['category'],
) {
  switch (
    category
  ) {
    case 'PAYMENT':
      return 'success' as const;

    case 'INVOICE':
      return 'warning' as const;

    case 'READING':
      return 'success' as const;

    default:
      return 'neutral' as const;
  }
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

  const [
    history,
    setHistory,
  ] =
    useState<
      PropertyHistoryItem[]
    >([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const property =
    state.properties.find(
      (
        item,
      ) =>
        item.id ===
        route.params
          ?.propertyId,
    );

  const propertyId =
    property?.id;

  useFocusEffect(
    useCallback(
      () => {
        if (
          !propertyId
        ) {
          return;
        }

        let active =
          true;

        const load =
          async () => {
            setHistoryLoading(
              true,
            );

            try {
              const items =
                await loadPropertyHistory(
                  propertyId,
                  20,
                );

              if (
                active
              ) {
                setHistory(
                  items,
                );
              }
            } catch (
              error
            ) {
              console.error(
                '[Dometra] Unable to load property history:',
                error,
              );
            } finally {
              if (
                active
              ) {
                setHistoryLoading(
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
        propertyId,
      ],
    ),
  );

  if (
    !property
  ) {
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
                void removeMeter(
                  meterId,
                );
              },
          },
        ],
      );
    };

  const createInvoice =
    () => {
      try {
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
      } catch (
        error
      ) {
        Alert.alert(
          'Invoices',
          error instanceof
          Error
            ? error.message
            : 'Unable to create invoice.',
        );
      }
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

                    {meter.billingMode ===
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
                              text={`Last ${formatReadingDate(
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

                    {meter.billingMode ===
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

                    {meter.billingMode ===
                    'VARIABLE' ? (
                      <>
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          Variable service
                        </Text>

                        {meter.lastAmount !==
                        undefined ? (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            {meter.lastAmountAt ? (
                              <Badge
                                text={`Last ${formatReadingDate(
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
                                meter.lastAmount
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

                  {meter.billingMode ===
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

                  {meter.billingMode ===
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
        title="History"
      />

      {historyLoading &&
      history.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading history...
          </Text>
        </Card>
      ) : null}

      {!historyLoading &&
      history.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No activity yet.
          </Text>
        </Card>
      ) : null}

      {history.map(
        (
          item,
        ) => (
          <View
            key={
              item.id
            }
            style={
              styles.historyRow
            }
          >
            <View
              style={
                styles.historyLineColumn
              }
            >
              <View
                style={
                  styles.historyDot
                }
              />

              <View
                style={
                  styles.historyLine
                }
              />
            </View>

            <View
              style={
                styles.historyContent
              }
            >
              <View
                style={
                  styles.historyHeader
                }
              >
                <Text
                  style={
                    styles.historyTitle
                  }
                >
                  {
                    item.title
                  }
                </Text>

                <Badge
                  text={
                    item.category
                  }
                  tone={
                    historyTone(
                      item.category,
                    )
                  }
                />
              </View>

              {item.details ? (
                <Text
                  style={
                    styles.historyDetails
                  }
                >
                  {
                    item.details
                  }
                </Text>
              ) : null}

              <Text
                style={
                  styles.historyDate
                }
              >
                {formatHistoryDate(
                  item.timestamp,
                )}
              </Text>
            </View>
          </View>
        ),
      )}

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

    historyRow: {
      flexDirection:
        'row',

      minHeight:
        78,
    },

    historyLineColumn: {
      width:
        22,

      alignItems:
        'center',
    },

    historyDot: {
      width:
        10,

      height:
        10,

      borderRadius:
        5,

      backgroundColor:
        colors.primary,

      marginTop:
        7,
    },

    historyLine: {
      width:
        1,

      flex:
        1,

      backgroundColor:
        colors.border,

      marginTop:
        5,
    },

    historyContent: {
      flex:
        1,

      paddingLeft:
        spacing.sm,

      paddingBottom:
        spacing.md,
    },

    historyHeader: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.sm,
    },

    historyTitle: {
      flex:
        1,

      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    historyDetails: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        4,
    },

    historyDate: {
      color:
        colors.muted,

      fontSize:
        11,

      marginTop:
        5,
    },
  });