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
  landlordCacheKeys,
  landlordCacheTtl,
  loadLandlordCachedQuery,
  readLandlordCache,
} from '../services/landlordCache';
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
}: {
  label:
    string;
  value:
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
    </View>
  );
}

export function LandlordStatisticsScreen() {
  const billingPeriod =
    currentBillingPeriod();

  const initialStatisticsSnapshot =
    readLandlordCache<
      LandlordPortfolioStatistics
    >(
      landlordCacheKeys.portfolio(
        billingPeriod,
      ),
    );

  const initialStatistics =
    initialStatisticsSnapshot.hasValue
      ? initialStatisticsSnapshot.value
      : undefined;

  const [
    statistics,
    setStatistics,
  ] =
    useState<
      LandlordPortfolioStatistics | null
    >(
      initialStatistics ??
        null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      !initialStatistics,
    );

  const reload =
    useCallback(
      async (
        force = false,
      ) => {
        const period =
          currentBillingPeriod();

        const cached =
          readLandlordCache<
            LandlordPortfolioStatistics
          >(
            landlordCacheKeys.portfolio(
              period,
            ),
          );

        if (
          !cached.hasValue
        ) {
          setLoading(
            true,
          );
        }

        try {
          setStatistics(
            await loadLandlordCachedQuery(
              landlordCacheKeys.portfolio(
                period,
              ),
              () =>
                loadLandlordPortfolioStatistics(
                  period,
                ),
              {
                ttlMs:
                  landlordCacheTtl.portfolio,
                force,
              },
            ),
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Statistics',

            error instanceof
            Error
              ? error.message
              : 'Unable to load statistics.',
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
                label="Paid"
                value={
                  String(
                    statistics.paidProperties,
                  )
                }
              />

              <Metric
                label="Awaiting"
                value={
                  String(
                    statistics.awaitingProperties,
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

          <SectionTitle
            title="This month"
          />

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
                    styles.row
                  }
                >
                  <Text
                    style={
                      styles.rowLabel
                    }
                  >
                    Expected
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
                    Awaiting confirmation
                  </Text>

                  <Text
                    style={
                      styles.awaitingValue
                    }
                  >
                    {money(
                      stats.awaiting,
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
              </Card>
            ),
          )}
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

    currencyHeader: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

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

    row: {
      flexDirection:
        'row',

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

    awaitingValue: {
      color:
        '#C2410C',

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

    muted: {
      color:
        colors.muted,

      fontSize:
        12,
    },
  });