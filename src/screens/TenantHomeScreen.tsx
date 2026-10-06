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
} from '@react-navigation/native';

import {
  useTranslation,
} from 'react-i18next';

import {
  Badge,
  Card,
  Header,
  Screen,
} from '../components/ui';

import {
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  billingErrorMessage,
  currentBillingPeriod,
  getTenantPaymentState,
  loadTenantBillingSummary,
  TenantBillingSummary,
} from '../services/billingRepository';

import {
  loadCheckoutSummaries,
  TenancyCheckout,
} from '../services/checkoutRepository';

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

function isServiceSubmitted(
  meter:
    Meter,

  billing:
    TenantBillingSummary | undefined,
) {
  if (
    meter.billingMode ===
    'FIXED'
  ) {
    return true;
  }

  if (
    !billing
  ) {
    return false;
  }

  const kind =
    meter.billingMode ===
    'METERED'
      ? 'METERED'
      : 'VARIABLE';

  const lines =
    billing.lines.filter(
      line =>
        line.kind ===
          kind &&
        line.propertyServiceId ===
          meter.serviceId,
    );

  if (
    lines.length ===
    0
  ) {
    return false;
  }

  if (
    meter.billingMode ===
    'METERED'
  ) {
    return lines.every(
      line =>
        Boolean(
          line.meterRegisterReadingId,
        ),
    );
  }

  return lines.every(
    line =>
      line.amount !==
      undefined,
  );
}

function submissionSummary(
  apartment:
    TenantApartmentPortal,

  billing:
    TenantBillingSummary | undefined,
) {
  const required =
    apartment.meters.filter(
      meter =>
        meter.billingMode ===
          'METERED' ||
        meter.billingMode ===
          'VARIABLE',
    );

  return {
    total:
      required.length,

    submitted:
      required.filter(
        meter =>
          isServiceSubmitted(
            meter,
            billing,
          ),
      ).length,
  };
}

export function TenantHomeScreen() {
  const navigation =
    useNavigation<any>();

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
    checkouts,
    setCheckouts,
  ] =
    useState<
      Record<
        string,
        TenancyCheckout
      >
    >({});

  const [
    billingByTenancy,
    setBillingByTenancy,
  ] =
    useState<
      Record<
        string,
        TenantBillingSummary
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

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

              const tenancyIds =
                data.map(
                  apartment =>
                    apartment.tenancyId,
                );

              const [
                checkoutData,
                billingRows,
              ] =
                await Promise.all([
                  loadCheckoutSummaries(
                    tenancyIds,
                  ),

                  Promise.all(
                    tenancyIds.map(
                      tenancyId =>
                        loadTenantBillingSummary(
                          tenancyId,
                          currentBillingPeriod(),
                        ),
                    ),
                  ),
                ]);

              if (
                !active
              ) {
                return;
              }

              const nextBilling:
                Record<
                  string,
                  TenantBillingSummary
                > = {};

              for (
                const billing
                of billingRows
              ) {
                nextBilling[
                  billing.tenancyId
                ] =
                  billing;
              }

              setApartments(
                data,
              );

              setCheckouts(
                checkoutData,
              );

              setBillingByTenancy(
                nextBilling,
              );
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  t(
                    'home',
                    {
                      defaultValue:
                        'Home',
                    },
                  ),

                  billingErrorMessage(
                    error,
                    'Unable to load your apartments.',
                  ),
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

  const openApartment =
    (
      apartment:
        TenantApartmentPortal,
    ) => {
      navigation.navigate(
        'TenantApartment',
        {
          tenancyId:
            apartment.tenancyId,
        },
      );
    };

  return (
    <Screen>
      <Header
        title={t(
          'tenantMyRent',
          {
            defaultValue:
              'My rent',
          },
        )}
        subtitle={t(
          'tenantMyRentSubtitle',
          {
            defaultValue:
              'Your rental apartments',
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
            Loading apartments...
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
            When you accept an apartment invitation, it will appear here.
          </Text>
        </Card>
      ) : null}

      {apartments.map(
        apartment => {
          const checkout =
            checkouts[
              apartment.tenancyId
            ];

          const checkoutPending =
            checkout?.status ===
              'PENDING' ||
            apartment.status ===
              'CHECKOUT_PENDING';

          const billing =
            billingByTenancy[
              apartment.tenancyId
            ];

          const paymentState =
            getTenantPaymentState(
              billing?.claim ??
                null,

              currentBillingPeriod(),

              apartment.paymentDueDay,
            );

          const submission =
            submissionSummary(
              apartment,
              billing,
            );

          const allSubmitted =
            submission.total ===
              0 ||
            submission.submitted ===
              submission.total;

          return (
            <Pressable
              key={
                apartment.tenancyId
              }
              onPress={() =>
                openApartment(
                  apartment,
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
                      }
                      ,{' '}
                      {
                        apartment.propertyCity
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.badges
                    }
                  >
                    {checkoutPending ? (
                      <Badge
                        text="Checkout"
                        tone="warning"
                      />
                    ) : null}

                    <PaymentStatusBadge
                      state={
                        paymentState
                      }
                      text={
                        paymentState ===
                        'PAID'
                          ? 'Paid'

                          : paymentState ===
                              'OVERDUE'
                            ? 'Payment overdue'

                            : 'Payment due'
                      }
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.footer
                  }
                >
                  <View
                    style={
                      styles.statusRow
                    }
                  >
                    <Text
                      style={
                        styles.statusLabel
                      }
                    >
                      Monthly values
                    </Text>

                    <Badge
                      text={
                        allSubmitted
                          ? 'Submitted'
                          : `${submission.submitted}/${submission.total} submitted`
                      }
                      tone={
                        allSubmitted
                          ? 'success'
                          : 'warning'
                      }
                    />
                  </View>

                  {checkoutPending ? (
                    <Text
                      style={
                        styles.checkoutHint
                      }
                    >
                      Checkout is in progress. Submit final meter readings.
                    </Text>
                  ) : null}

                  {!checkoutPending &&
                  !allSubmitted ? (
                    <Text
                      style={
                        styles.dueHint
                      }
                    >
                      Some meter readings or variable expenses are still missing.
                    </Text>
                  ) : null}

                  {paymentState ===
                  'OVERDUE' ? (
                    <Text
                      style={
                        styles.overdueHint
                      }
                    >
                      The monthly payment is overdue. Open the apartment to review the bill.
                    </Text>
                  ) : null}

                  {paymentState ===
                  'PAID' ? (
                    <Text
                      style={
                        styles.completeHint
                      }
                    >
                      Payment was marked as paid for this month.
                    </Text>
                  ) : null}

                  <Text
                    style={
                      styles.openText
                    }
                  >
                    Open details ›
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        },
      )}
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    pressable: {
      marginBottom:
        spacing.sm,
    },

    pressed: {
      opacity:
        0.72,
    },

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

    badges: {
      alignItems:
        'flex-end',

      gap:
        6,
    },

    propertyName: {
      color:
        colors.text,

      fontSize:
        19,

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

    footer: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,

      gap:
        6,
    },

    statusRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    statusLabel: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    openText: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '800',

      marginTop:
        4,
    },

    checkoutHint: {
      color:
        '#92400E',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '700',
    },

    dueHint: {
      color:
        '#92400E',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '600',
    },

    overdueHint: {
      color:
        '#B42318',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '700',
    },

    completeHint: {
      color:
        '#166534',

      fontSize:
        12,

      lineHeight:
        18,

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
  });