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
  useTranslation,
} from 'react-i18next';

import {
  Card,
  Header,
  Screen,
  SectionTitle,
} from '../components/ui';

import {
  loadTenantApartments,
  TenantApartmentPortal,
} from '../services/tenantPortalRepository';

import {
  loadTenantExpenseStatistics,
  TenantExpenseStatistics,
} from '../services/tenantStatisticsRepository';

import {
  colors,
  spacing,
} from '../theme';

function formatMoney(
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

function formatPeriod(
  value:
    string,
) {
  const [
    year,
    month,
  ] =
    value.split(
      '-',
    );

  const date =
    new Date(
      Number(
        year,
      ),

      Number(
        month,
      ) -
        1,

      1,
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
      month:
        'short',

      year:
        'numeric',
    },
  );
}

export function TenantStatisticsScreen() {
  const {
    t,
  } =
    useTranslation();

  const [
    apartments,
    setApartments,
  ] =
    useState<
      TenantApartmentPortal[]
    >([]);

  const [
    statistics,
    setStatistics,
  ] =
    useState<
      TenantExpenseStatistics | null
    >(null);

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
              const apartmentData =
                await loadTenantApartments();

              const stats =
                await loadTenantExpenseStatistics(
                  apartmentData,
                );

              if (
                active
              ) {
                setApartments(
                  apartmentData,
                );

                setStatistics(
                  stats,
                );
              }
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  t(
                    'statistics',
                    {
                      defaultValue:
                        'Statistics',
                    },
                  ),

                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load statistics.',
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

      [
        t,
      ],
    ),
  );

  const hasData =
    Boolean(
      statistics &&
      (
        statistics.current.length >
          0 ||
        statistics.history.length >
          0
      ),
    );

  return (
    <Screen>
      <Header
        title={t(
          'statistics',
          {
            defaultValue:
              'Statistics',
          },
        )}
        subtitle={t(
          'tenantStatisticsSubtitle',
          {
            defaultValue:
              'Rent, utilities and total apartment expenses',
          },
        )}
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            {t(
              'loadingStatistics',
              {
                defaultValue:
                  'Loading statistics...',
              },
            )}
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
            {t(
              'noActiveTenancy',
              {
                defaultValue:
                  'No active tenancy',
              },
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'statisticsNeedApartment',
              {
                defaultValue:
                  'Statistics will appear after you join an apartment.',
              },
            )}
          </Text>
        </Card>
      ) : null}

      {!loading &&
      apartments.length >
        0 &&
      !hasData ? (
        <Card>
          <Text
            style={
              styles.title
            }
          >
            {t(
              'noExpenseData',
              {
                defaultValue:
                  'No expense data yet',
              },
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'statisticsAfterInvoice',
              {
                defaultValue:
                  'Statistics will appear after an invoice is issued.',
              },
            )}
          </Text>
        </Card>
      ) : null}

      {!loading &&
      statistics &&
      statistics.current.length >
        0 ? (
        <>
          <SectionTitle
            title={`${t(
              'thisMonth',
              {
                defaultValue:
                  'This month',
              },
            )} · ${formatPeriod(
              statistics.currentPeriod,
            )}`}
          />

          {statistics.current.map(
            bucket => (
              <Card
                key={
                  bucket.currency
                }
              >
                <View
                  style={
                    styles.totalRow
                  }
                >
                  <Text
                    style={
                      styles.totalLabel
                    }
                  >
                    {t(
                      'totalExpenses',
                      {
                        defaultValue:
                          'Total expenses',
                      },
                    )}
                  </Text>

                  <Text
                    style={
                      styles.totalValue
                    }
                  >
                    {formatMoney(
                      bucket.total,
                      bucket.currency,
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.separator
                  }
                />

                <View
                  style={
                    styles.breakdownRow
                  }
                >
                  <View
                    style={
                      styles.breakdownCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {t(
                        'rent',
                        {
                          defaultValue:
                            'Rent',
                        },
                      )}
                    </Text>

                    <Text
                      style={
                        styles.value
                      }
                    >
                      {formatMoney(
                        bucket.rent,
                        bucket.currency,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.breakdownCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {t(
                        'utilities',
                        {
                          defaultValue:
                            'Utilities',
                        },
                      )}
                    </Text>

                    <Text
                      style={
                        styles.value
                      }
                    >
                      {formatMoney(
                        bucket.utilities,
                        bucket.currency,
                      )}
                    </Text>
                  </View>
                </View>

                {bucket.other >
                0.009 ? (
                  <View
                    style={
                      styles.otherRow
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {t(
                        'other',
                        {
                          defaultValue:
                            'Other',
                        },
                      )}
                    </Text>

                    <Text
                      style={
                        styles.value
                      }
                    >
                      {formatMoney(
                        bucket.other,
                        bucket.currency,
                      )}
                    </Text>
                  </View>
                ) : null}
              </Card>
            ),
          )}
        </>
      ) : null}

      {!loading &&
      statistics &&
      statistics.apartments.length >
        0 ? (
        <>
          <SectionTitle
            title={t(
              'byApartment',
              {
                defaultValue:
                  'By apartment',
              },
            )}
          />

          {statistics.apartments.map(
            item => (
              <Card
                key={`${item.tenancyId}:${item.currency}`}
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
                        item.propertyName
                      }
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      {t(
                        'rentAndUtilities',
                        {
                          defaultValue:
                            'Rent + utilities',
                        },
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.apartmentTotal
                    }
                  >
                    {formatMoney(
                      item.total,
                      item.currency,
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.miniBreakdown
                  }
                >
                  <Text
                    style={
                      styles.miniText
                    }
                  >
                    Rent:{' '}
                    {formatMoney(
                      item.rent,
                      item.currency,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.miniText
                    }
                  >
                    Utilities:{' '}
                    {formatMoney(
                      item.utilities,
                      item.currency,
                    )}
                  </Text>
                </View>
              </Card>
            ),
          )}
        </>
      ) : null}

      {!loading &&
      statistics &&
      statistics.history.length >
        0 ? (
        <>
          <SectionTitle
            title={t(
              'lastSixMonths',
              {
                defaultValue:
                  'Last 6 months',
              },
            )}
          />

          <Card>
            {statistics.history.map(
              (
                item,
                index,
              ) => {
                const maxForCurrency =
                  Math.max(
                    ...statistics.history
                      .filter(
                        entry =>
                          entry.currency ===
                          item.currency,
                      )
                      .map(
                        entry =>
                          entry.total,
                      ),

                    1,
                  );

                const percent =
                  Math.max(
                    item.total >
                      0
                      ? 4
                      : 0,

                    Math.min(
                      100,

                      (
                        item.total /
                        maxForCurrency
                      ) *
                        100,
                    ),
                  );

                return (
                  <View
                    key={`${item.period}:${item.currency}`}
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
                        styles.historyHeader
                      }
                    >
                      <Text
                        style={
                          styles.historyPeriod
                        }
                      >
                        {formatPeriod(
                          item.period,
                        )}
                      </Text>

                      <Text
                        style={
                          styles.historyValue
                        }
                      >
                        {formatMoney(
                          item.total,
                          item.currency,
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.barTrack
                      }
                    >
                      <View
                        style={[
                          styles.barFill,

                          {
                            width:
                              `${percent}%` as `${number}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              },
            )}
          </Card>
        </>
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

    totalRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    totalLabel: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    totalValue: {
      color:
        colors.text,

      fontSize:
        21,

      fontWeight:
        '900',
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    breakdownRow: {
      flexDirection:
        'row',

      gap:
        spacing.md,
    },

    breakdownCell: {
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
        14,

      fontWeight:
        '800',

      marginTop:
        5,
    },

    otherRow: {
      marginTop:
        spacing.md,
    },

    apartmentTotal: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '900',
    },

    miniBreakdown: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        spacing.md,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,
    },

    miniText: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '600',
    },

    smallSeparator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    historyHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    historyPeriod: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '700',
    },

    historyValue: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    barTrack: {
      height:
        8,

      borderRadius:
        999,

      backgroundColor:
        colors.border,

      overflow:
        'hidden',

      marginTop:
        8,
    },

    barFill: {
      height:
        '100%',

      borderRadius:
        999,

      backgroundColor:
        colors.primary,
    },
  });