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
} from '@react-navigation/native';

import {
  Card,
  Header,
  Screen,
  SectionTitle,
} from '../components/ui';

import {
  billingMonthLabel,
  currentBillingPeriod,
} from '../services/billingRepository';

import {
  LandlordCurrencyStatistics,
  LandlordPortfolioStatistics,
  loadLandlordPortfolioStatistics,
} from '../services/landlordPortfolioRepository';

import {
  colors,
  spacing,
} from '../theme';

function money(
  value:
    number,

  currency:
    string,
) {
  return `${value.toLocaleString(
    undefined,
    {
      maximumFractionDigits:
        2,
    },
  )} ${currency}`;
}

function collectionRate(
  stats:
    LandlordCurrencyStatistics,
) {
  if (
    stats.expected <=
    0
  ) {
    return 0;
  }

  return Math.min(
    Math.round(
      (
        stats.received /
        stats.expected
      ) *
        100,
    ),
    100,
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label:
    string;

  value:
    string;

  hint?:
    string;
}) {
  return (
    <View
      style={
        styles.metric
      }
    >
      <Text
        style={
          styles.metricLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.metricValue
        }
      >
        {value}
      </Text>

      {hint ? (
        <Text
          style={
            styles.metricHint
          }
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function LandlordStatisticsScreen() {
  const [
    statistics,
    setStatistics,
  ] =
    useState<
      LandlordPortfolioStatistics | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const reload =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const data =
            await loadLandlordPortfolioStatistics(
              currentBillingPeriod(),
            );

          setStatistics(
            data,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Statistics',

            error instanceof
            Error
              ? error.message
              : 'Unable to load landlord statistics.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void reload();
      },

      [
        reload,
      ],
    ),
  );

  return (
    <Screen>
      <Header
        title="Statistics"
        subtitle={
          billingMonthLabel(
            currentBillingPeriod(),
          )
        }
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading statistics...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      statistics ? (
        <>
          <SectionTitle
            title="Portfolio"
          />

          <Card>
            <View
              style={
                styles.grid
              }
            >
              <Metric
                label="Properties"
                value={
                  String(
                    statistics.totalProperties,
                  )
                }
              />

              <Metric
                label="Occupied"
                value={
                  String(
                    statistics.occupiedProperties,
                  )
                }
              />

              <Metric
                label="Vacant"
                value={
                  String(
                    statistics.vacantProperties,
                  )
                }
              />

              <Metric
                label="Paid"
                value={
                  String(
                    statistics.paidProperties,
                  )
                }
              />

              <Metric
                label="Pending"
                value={
                  String(
                    statistics.pendingProperties,
                  )
                }
              />

              <Metric
                label="Delayed"
                value={
                  String(
                    statistics.delayedProperties,
                  )
                }
              />
            </View>
          </Card>

          {statistics.incompleteBills >
          0 ? (
            <Card>
              <Text
                style={
                  styles.warningTitle
                }
              >
                Billing data incomplete
              </Text>

              <Text
                style={
                  styles.warningText
                }
              >
                {statistics.incompleteBills}{' '}
                occupied apartment
                {statistics.incompleteBills ===
                1
                  ? ''
                  : 's'}{' '}
                still have missing readings, variable expenses or tariffs. Expected totals may increase after those values are entered.
              </Text>
            </Card>
          ) : null}

          <SectionTitle
            title="This month"
          />

          {statistics.currencies.length ===
          0 ? (
            <Card>
              <Text
                style={
                  styles.muted
                }
              >
                No monthly billing data yet.
              </Text>
            </Card>
          ) : null}

          {statistics.currencies.map(
            stats => (
              <Card
                key={
                  stats.currency
                }
              >
                <View
                  style={
                    styles.currencyHeader
                  }
                >
                  <Text
                    style={
                      styles.currency
                    }
                  >
                    {
                      stats.currency
                    }
                  </Text>

                  <Text
                    style={
                      styles.rate
                    }
                  >
                    {collectionRate(
                      stats,
                    )}% collected
                  </Text>
                </View>

                <View
                  style={
                    styles.metricRows
                  }
                >
                  <View
                    style={
                      styles.row
                    }
                  >
                    <Text
                      style={
                        styles.rowLabel
                      }
                    >
                      Expected this month
                    </Text>

                    <Text
                      style={
                        styles.rowValue
                      }
                    >
                      {money(
                        stats.expected,
                        stats.currency,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.row
                    }
                  >
                    <Text
                      style={
                        styles.rowLabel
                      }
                    >
                      Received
                    </Text>

                    <Text
                      style={
                        styles.receivedValue
                      }
                    >
                      {money(
                        stats.received,
                        stats.currency,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.row
                    }
                  >
                    <Text
                      style={
                        styles.rowLabel
                      }
                    >
                      Pending
                    </Text>

                    <Text
                      style={
                        styles.pendingValue
                      }
                    >
                      {money(
                        stats.pending,
                        stats.currency,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.row
                    }
                  >
                    <Text
                      style={
                        styles.rowLabel
                      }
                    >
                      Debt
                    </Text>

                    <Text
                      style={
                        styles.debtValue
                      }
                    >
                      {money(
                        stats.debt,
                        stats.currency,
                      )}
                    </Text>
                  </View>
                </View>
              </Card>
            ),
          )}

          <SectionTitle
            title="Rent forecast"
          />

          <Card>
            <Text
              style={
                styles.muted
              }
            >
              Contract rent expected from all currently occupied apartments. Utilities and variable expenses are not included in this forecast.
            </Text>

            {statistics.currencies.length ===
            0 ? (
              <Text
                style={
                  styles.emptyForecast
                }
              >
                No active rent terms.
              </Text>
            ) : (
              statistics.currencies.map(
                stats => (
                  <View
                    key={
                      stats.currency
                    }
                    style={
                      styles.forecastRow
                    }
                  >
                    <Text
                      style={
                        styles.rowLabel
                      }
                    >
                      {
                        stats.currency
                      }
                    </Text>

                    <Text
                      style={
                        styles.forecastValue
                      }
                    >
                      {money(
                        stats.rentForecast,
                        stats.currency,
                      )}
                    </Text>
                  </View>
                ),
              )
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    grid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        spacing.sm,
    },

    metric: {
      width:
        '47%',

      minHeight:
        82,

      borderWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,

      borderRadius:
        12,

      padding:
        spacing.md,
    },

    metricLabel: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    metricValue: {
      color:
        colors.text,

      fontSize:
        24,

      fontWeight:
        '900',

      marginTop:
        6,
    },

    metricHint: {
      color:
        colors.muted,

      fontSize:
        10,

      marginTop:
        3,
    },

    currencyHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      marginBottom:
        spacing.sm,
    },

    currency: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '900',
    },

    rate: {
      color:
        colors.primary,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    metricRows: {
      gap:
        2,
    },

    row: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      paddingVertical:
        11,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,
    },

    rowLabel: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    rowValue: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    receivedValue: {
      color:
        '#166534',

      fontSize:
        15,

      fontWeight:
        '900',
    },

    pendingValue: {
      color:
        '#92400E',

      fontSize:
        15,

      fontWeight:
        '900',
    },

    debtValue: {
      color:
        '#B42318',

      fontSize:
        15,

      fontWeight:
        '900',
    },

    forecastRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      paddingTop:
        spacing.md,
    },

    forecastValue: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '900',
    },

    warningTitle: {
      color:
        '#92400E',

      fontSize:
        14,

      fontWeight:
        '800',
    },

    warningText: {
      color:
        '#92400E',

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,
    },

    emptyForecast: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        spacing.md,
    },
  });