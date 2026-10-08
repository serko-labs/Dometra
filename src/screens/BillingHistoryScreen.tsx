import React, {
  useCallback,
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
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  Card,
  Header,
  Screen,
} from '../components/ui';

import {
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  billingMonthLabel,
  TenantPaymentState,
} from '../services/billingRepository';

import {
  BillingHistoryItem,
  loadTenancyBillingHistory,
} from '../services/billingHistoryRepository';

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

function badgeText(
  state:
    TenantPaymentState,
) {
  switch (
    state
  ) {
    case 'PAID':
      return 'Paid';

    case 'AWAITING':
      return 'Awaiting';

    case 'OVERDUE':
      return 'Delayed';

    case 'DUE':
    default:
      return 'Pending';
  }
}

export function BillingHistoryScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const propertyName =
    route.params
      ?.propertyName as
      | string
      | undefined;

  const mode =
    (
      route.params
        ?.mode as
        | 'TENANT'
        | 'LANDLORD'
        | undefined
    ) ??
    'TENANT';

  const [
    history,
    setHistory,
  ] =
    useState<
      BillingHistoryItem[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const result =
            await loadTenancyBillingHistory(
              tenancyId,
              12,
            );

          setHistory(
            result,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Billing history',

            error instanceof
            Error
              ? error.message
              : 'Unable to load billing history.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        tenancyId,
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

  const openPeriod =
    (
      item:
        BillingHistoryItem,
    ) => {
      navigation.navigate(
        'TenantBilling',

        {
          tenancyId,

          propertyName,

          paymentDueDay:
            item.paymentDueDay,

          billingPeriod:
            item.billingPeriod,

          mode,
        },
      );
    };

  return (
    <Screen>
      <Header
        title="Billing history"
        subtitle={
          propertyName ??
          'Monthly rent and expenses'
        }
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading billing history...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      history.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No billing history
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Monthly bills will appear here after the tenancy starts.
          </Text>
        </Card>
      ) : null}

      {history.map(
        item => (
          <Pressable
            key={
              item.billingPeriod
            }
            onPress={() =>
              openPeriod(
                item,
              )
            }
            style={({
              pressed,
            }) => [
              styles.pressable,

              pressed &&
                styles.pressed,
            ]}
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
                      styles.month
                    }
                  >
                    {billingMonthLabel(
                      item.billingPeriod,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.due
                    }
                  >
                    Payment due · day{' '}
                    {
                      item.paymentDueDay
                    }
                  </Text>
                </View>

                <PaymentStatusBadge
                  state={
                    item.state
                  }
                  text={
                    badgeText(
                      item.state,
                    )
                  }
                />
              </View>

              <View
                style={
                  styles.separator
                }
              />

              {item.totals.length >
              0 ? (
                item.totals.map(
                  total => (
                    <View
                      key={
                        total.currency
                      }
                      style={
                        styles.totalRow
                      }
                    >
                      <Text
                        style={
                          styles.totalCurrency
                        }
                      >
                        {
                          total.currency
                        }
                      </Text>

                      <Text
                        style={
                          styles.totalValue
                        }
                      >
                        {money(
                          total.total,
                          total.currency,
                        )}
                      </Text>
                    </View>
                  ),
                )
              ) : (
                <Text
                  style={
                    styles.muted
                  }
                >
                  No completed totals for this month.
                </Text>
              )}

              {!item.ready ? (
                <View
                  style={
                    styles.incompleteBox
                  }
                >
                  <Text
                    style={
                      styles.incompleteText
                    }
                  >
                    {item.missingCount}{' '}
                    billing item
                    {item.missingCount ===
                    1
                      ? ''
                      : 's'}{' '}
                    missing
                  </Text>
                </View>
              ) : null}

              <Text
                style={
                  styles.openText
                }
              >
                View bill ›
              </Text>
            </Card>
          </Pressable>
        ),
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

    pressable: {
      marginBottom:
        spacing.sm,
    },

    pressed: {
      opacity:
        0.72,
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

    month: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    due: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        4,
    },

    separator: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.sm,
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

      paddingVertical:
        7,
    },

    totalCurrency: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    totalValue: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '900',
    },

    incompleteBox: {
      marginTop:
        spacing.sm,

      paddingHorizontal:
        10,

      paddingVertical:
        8,

      borderRadius:
        10,

      backgroundColor:
        '#FEF3C7',
    },

    incompleteText: {
      color:
        '#92400E',

      fontSize:
        11,

      fontWeight:
        '700',
    },

    openText: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '800',

      marginTop:
        spacing.md,
    },

    emptyTitle: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',

      marginBottom:
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
  });