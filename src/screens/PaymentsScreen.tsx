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
  Money,
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  FinancePayment,
  loadWorkspacePayments,
} from '../services/financeRepository';

import {
  getPropertyTenancy,
} from '../services/tenantRepository';

import {
  colors,
  spacing,
} from '../theme';

interface PaymentLocation {
  propertyId: string;
  propertyName: string;
}

function formatDate(
  value: string,
) {
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

export function PaymentsScreen() {
  const navigation =
    useNavigation<any>();

  const {
    state,
  } =
    useApp();

  const [
    payments,
    setPayments,
  ] =
    useState<
      FinancePayment[]
    >([]);

  const [
    paymentLocations,
    setPaymentLocations,
  ] =
    useState<
      Record<
        string,
        PaymentLocation
      >
    >({});

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
            const workspaceId =
              state.workspace?.id;

            if (!workspaceId) {
              if (active) {
                setPayments(
                  [],
                );

                setPaymentLocations(
                  {},
                );

                setLoading(
                  false,
                );
              }

              return;
            }

            setLoading(
              true,
            );

            try {
              const [
                paymentData,
                tenancyData,
              ] =
                await Promise.all([
                  loadWorkspacePayments(
                    workspaceId,
                  ),

                  Promise.all(
                    state.properties.map(
                      async property => ({
                        property,

                        tenancy:
                          await getPropertyTenancy(
                            property.id,
                          ),
                      }),
                    ),
                  ),
                ]);

              if (!active) {
                return;
              }

              const locations:
                Record<
                  string,
                  PaymentLocation
                > = {};

              for (
                const row
                of tenancyData
              ) {
                if (
                  !row.tenancy
                ) {
                  continue;
                }

                locations[
                  row.tenancy.id
                ] = {
                  propertyId:
                    row.property.id,

                  propertyName:
                    row.property.name,
                };
              }

              setPayments(
                paymentData,
              );

              setPaymentLocations(
                locations,
              );
            } catch (error) {
              if (active) {
                Alert.alert(
                  'Payments',
                  error instanceof Error
                    ? error.message
                    : 'Unable to load payments.',
                );
              }
            } finally {
              if (active) {
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
        state.workspace?.id,
        state.properties,
      ],
    ),
  );

  return (
    <Screen>
      <Header
        title="Payments"
        subtitle="Tenant payments and advances"
      />

      <PrimaryButton
        title="+ Add payment"
        onPress={() =>
          navigation.navigate(
            'AddPayment',
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
            Loading payments...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      payments.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No payments yet
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Record a tenant payment here. Dometra will
            automatically apply it to the oldest open invoice
            and keep any remainder as advance.
          </Text>
        </Card>
      ) : null}

      {payments.map(
        payment => {
          const location =
            paymentLocations[
              payment.tenancyId
            ];

          const hasAdvance =
            payment.advanceBaseAmount >
            0.009;

          const fullyAllocated =
            payment.allocatedBaseAmount >=
            payment.baseAmount -
              0.009;

          return (
            <Card
              key={
                payment.id
              }
            >
              <View
                style={
                  styles.row
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
                    {location?.propertyName ??
                      'Previous tenancy'}
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {formatDate(
                      payment.paymentDate,
                    )}
                    {' • '}
                    {payment.method.replace(
                      /_/g,
                      ' ',
                    )}
                  </Text>

                  {payment.note ? (
                    <Text
                      style={
                        styles.muted
                      }
                    >
                      {payment.note}
                    </Text>
                  ) : null}

                  {payment.currency !==
                  payment.baseCurrency ? (
                    <Text
                      style={
                        styles.fx
                      }
                    >
                      Base value:{' '}
                      {payment.baseAmount.toLocaleString()}{' '}
                      {payment.baseCurrency}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={
                    styles.right
                  }
                >
                  <Money
                    amount={
                      payment.amount
                    }
                    currency={
                      payment.currency
                    }
                    strong
                  />

                  {hasAdvance ? (
                    <Badge
                      text={`Advance ${payment.advanceBaseAmount.toLocaleString()} ${payment.baseCurrency}`}
                      tone="warning"
                    />
                  ) : (
                    <Badge
                      text={
                        fullyAllocated
                          ? 'Allocated'
                          : 'Partially allocated'
                      }
                      tone={
                        fullyAllocated
                          ? 'success'
                          : 'warning'
                      }
                    />
                  )}
                </View>
              </View>
            </Card>
          );
        },
      )}
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    row: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        spacing.md,
    },

    flex: {
      flex:
        1,
    },

    right: {
      alignItems:
        'flex-end',
      gap:
        7,
    },

    title: {
      color:
        colors.text,
      fontSize:
        16,
      fontWeight:
        '800',
    },

    emptyTitle: {
      color:
        colors.text,
      fontSize:
        15,
      fontWeight:
        '800',
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

    fx: {
      color:
        colors.muted,
      fontSize:
        11,
      marginTop:
        6,
    },
  });