import React, {
  useCallback,
  useMemo,
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
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  BillingPreviewLine,
  billingErrorMessage,
  currentBillingPeriod,
  getTenantPaymentState,
  loadTenantBillingSummary,
  reportTenantPayment,
  TenantBillingSummary,
} from '../services/billingRepository';

import {
  loadTenancyCheckout,
  TenancyCheckout,
} from '../services/checkoutRepository';

import {
  loadTenantFinanceBalances,
  TenantFinanceBalance,
} from '../services/financeRepository';

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
  value?:
    string,
) {
  if (
    !value
  ) {
    return '—';
  }

  const normalized =
    value.includes(
      'T',
    )
      ? value
      : `${value}T00:00:00`;

  const date =
    new Date(
      normalized,
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

function latestReadingText(
  meter:
    Meter,
) {
  return meter.registers
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
    )
    .join(
      ' • ',
    );
}

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

function billingLinesForMeter(
  meter:
    Meter,

  billing:
    TenantBillingSummary | null,
): BillingPreviewLine[] {
  if (
    !billing
  ) {
    return [];
  }

  const kind =
    meter.billingMode ===
    'METERED'
      ? 'METERED'
      : meter.billingMode ===
          'VARIABLE'
        ? 'VARIABLE'
        : 'FIXED';

  return billing.lines.filter(
    line =>
      line.kind ===
        kind &&
      line.propertyServiceId ===
        meter.serviceId,
  );
}

function isMeterValueSubmitted(
  meter:
    Meter,

  billing:
    TenantBillingSummary | null,
) {
  if (
    meter.billingMode ===
    'FIXED'
  ) {
    return true;
  }

  const lines =
    billingLinesForMeter(
      meter,
      billing,
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

function serviceStatusText(
  meter:
    Meter,

  billing:
    TenantBillingSummary | null,
) {
  if (
    meter.billingMode ===
    'FIXED'
  ) {
    return 'Included';
  }

  return isMeterValueSubmitted(
    meter,
    billing,
  )
    ? 'Submitted'
    : 'Missing';
}

export function TenantApartmentScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    t,
  } =
    useTranslation();

  const tenancyId =
    route.params
      ?.tenancyId as
      | string
      | undefined;

  const [
    apartment,
    setApartment,
  ] =
    useState<
      TenantApartmentPortal | null
    >(null);

  const [
    balance,
    setBalance,
  ] =
    useState<
      TenantFinanceBalance | null
    >(null);

  const [
    checkout,
    setCheckout,
  ] =
    useState<
      TenancyCheckout | null
    >(null);

  const [
    billing,
    setBilling,
  ] =
    useState<
      TenantBillingSummary | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    paymentBusy,
    setPaymentBusy,
  ] =
    useState(
      false,
    );

  const reload =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const apartments =
            await loadTenantApartments();

          const selected =
            apartments.find(
              item =>
                item.tenancyId ===
                tenancyId,
            ) ??
            null;

          if (
            !selected
          ) {
            throw new Error(
              'Apartment not found.',
            );
          }

          const [
            finance,
            checkoutData,
            billingData,
          ] =
            await Promise.all([
              loadTenantFinanceBalances(
                [
                  selected.tenancyId,
                ],
              ),

              loadTenancyCheckout(
                selected.tenancyId,
              ),

              loadTenantBillingSummary(
                selected.tenancyId,
                currentBillingPeriod(),
              ),
            ]);

          setApartment(
            selected,
          );

          setBalance(
            finance[0] ??
            null,
          );

          setCheckout(
            checkoutData,
          );

          setBilling(
            billingData,
          );
        } catch (
          error
        ) {
          Alert.alert(
            t(
              'apartment',
              {
                defaultValue:
                  'Apartment',
              },
            ),

            billingErrorMessage(
              error,
              'Unable to load apartment.',
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        tenancyId,
        t,
      ],
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

  const submissionSummary =
    useMemo(
      () => {
        if (
          !apartment
        ) {
          return {
            submitted:
              0,

            total:
              0,
          };
        }

        const requiredServices =
          apartment.meters.filter(
            meter =>
              meter.billingMode ===
                'METERED' ||
              meter.billingMode ===
                'VARIABLE',
          );

        return {
          total:
            requiredServices.length,

          submitted:
            requiredServices.filter(
              meter =>
                isMeterValueSubmitted(
                  meter,
                  billing,
                ),
            ).length,
        };
      },

      [
        apartment,
        billing,
      ],
    );

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title="Apartment"
          subtitle="Loading apartment..."
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading apartment...
          </Text>
        </Card>
      </Screen>
    );
  }

  if (
    !apartment
  ) {
    return (
      <Screen>
        <Header
          title="Apartment"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            Apartment not found
          </Text>
        </Card>
      </Screen>
    );
  }

  const checkoutPending =
    checkout?.status ===
      'PENDING' ||
    apartment.status ===
      'CHECKOUT_PENDING';

  const metered =
    apartment.meters.filter(
      meter =>
        meter.billingMode ===
        'METERED',
    );

  const hasDebt =
    Boolean(
      balance &&
      balance.outstanding >
        0.009,
    );

  const paymentState =
    getTenantPaymentState(
      billing?.claim ??
        null,

      currentBillingPeriod(),

      apartment.paymentDueDay,
    );

  const openMonthlyBill =
    () => {
      navigation.navigate(
        'TenantBilling',
        {
          tenancyId:
            apartment.tenancyId,

          propertyName:
            apartment.propertyName,

          paymentDueDay:
            apartment.paymentDueDay,

          mode:
            'TENANT',

          billingPeriod:
            currentBillingPeriod(),
        },
      );
    };

  const markPaid =
    () => {
      if (
        paymentBusy ||
        !billing ||
        billing.claim ||
        !billing.ready
      ) {
        return;
      }

      Alert.alert(
        'Mark as paid?',

        'Use this only after you have actually paid the rent and all expenses for this month. Dometra will generate the invoice and notify the landlord.',

        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Paid',

            onPress:
              async () => {
                setPaymentBusy(
                  true,
                );

                try {
                  const result =
                    await reportTenantPayment(
                      {
                        tenancyId:
                          apartment.tenancyId,

                        billingPeriod:
                          currentBillingPeriod(),
                      },
                    );

                  await reload();

                  Alert.alert(
                    'Payment recorded',

                    result.invoices.length >
                    1
                      ? `${result.invoices.length} invoices were generated because this month contains different currencies.`
                      : 'The invoice was generated and the landlord was notified.',

                    [
                      {
                        text:
                          'OK',
                      },

                      {
                        text:
                          'View bill',

                        onPress:
                          openMonthlyBill,
                      },
                    ],
                  );
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Unable to mark as paid',

                    billingErrorMessage(
                      error,
                      'Unable to mark this bill as paid.',
                    ),
                  );
                } finally {
                  setPaymentBusy(
                    false,
                  );
                }
              },
          },
        ],
      );
    };

  return (
    <Screen>
      <Header
        title={
          apartment.propertyName
        }
        subtitle={
          `${apartment.propertyAddress}, ${apartment.propertyCity}`
        }
      />

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
                styles.heroTitle
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

          {checkoutPending ? (
            <Badge
              text="Checkout"
              tone="warning"
            />
          ) : submissionSummary.total >
            0 ? (
            <Badge
              text={
                submissionSummary.submitted ===
                submissionSummary.total
                  ? 'Submitted'
                  : `${submissionSummary.submitted}/${submissionSummary.total} submitted`
              }
              tone={
                submissionSummary.submitted ===
                submissionSummary.total
                  ? 'success'
                  : 'warning'
              }
            />
          ) : (
            <Badge
              text="No inputs"
              tone="neutral"
            />
          )}
        </View>

        {apartment.areaM2 >
        0 ? (
          <Text
            style={
              styles.area
            }
          >
            {apartment.areaM2}{' '}
            m²
          </Text>
        ) : null}
      </Card>

      {checkoutPending ? (
        <Card>
          <Text
            style={
              styles.checkoutTitle
            }
          >
            Checkout in progress
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {checkout?.checkoutDate
              ? `Move-out date: ${formatDate(
                  checkout.checkoutDate,
                )}. `
              : ''}

            Regular monthly readings are disabled. Submit the final meter values for move-out.
          </Text>

          <View
            style={
              styles.buttonTop
            }
          >
            <SecondaryButton
              title="Submit final readings"
              onPress={() =>
                navigation.navigate(
                  'TenantCheckout',
                  {
                    tenancyId:
                      apartment.tenancyId,
                  },
                )
              }
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle
        title="Monthly payment"
      />

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
              Current month
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              Rent, metered utilities, fixed fees and variable expenses are included in this payment.
            </Text>
          </View>

          <PaymentStatusBadge
            state={
              paymentState
            }
          />
        </View>

        {billing &&
        !billing.ready &&
        !billing.claim ? (
          <Text
            style={
              styles.paymentWarning
            }
          >
            {billing.missingCount}{' '}
            billing item
            {billing.missingCount ===
            1
              ? ''
              : 's'}{' '}
            still need a value or tariff before payment can be completed.
          </Text>
        ) : null}

        {billing?.totals.map(
          total => (
            <View
              key={
                total.currency
              }
              style={
                styles.paymentTotalRow
              }
            >
              <Text
                style={
                  styles.label
                }
              >
                Total{' '}
                {
                  total.currency
                }
              </Text>

              <Text
                style={
                  styles.valueSmall
                }
              >
                {formatMoney(
                  total.total,
                  total.currency,
                )}
              </Text>
            </View>
          ),
        )}

        {!billing?.claim ? (
          <View
            style={
              styles.buttonTop
            }
          >
            <PrimaryButton
              title={
                paymentBusy
                  ? 'Saving...'
                  : 'Paid'
              }
              disabled={
                paymentBusy ||
                !billing?.ready
              }
              onPress={
                markPaid
              }
            />
          </View>
        ) : null}

        {!billing?.claim &&
        !billing?.ready ? (
          <Text
            style={
              styles.disabledHint
            }
          >
            Paid becomes available after all required monthly values are present.
          </Text>
        ) : null}

        {billing?.claim ? (
          <Text
            style={
              styles.paidHint
            }
          >
            You marked this month as paid. You can add or review payment proof in the bill details.
          </Text>
        ) : null}

        <View
          style={
            styles.buttonTop
          }
        >
          <SecondaryButton
            title={
              billing?.claim
                ? 'View paid bill'
                : 'View bill details'
            }
            onPress={
              openMonthlyBill
            }
          />
        </View>
      </Card>

      <SectionTitle
        title="Rent & tenancy"
      />

      <Card>
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
              Start date
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
              {checkoutPending &&
              checkout?.checkoutDate
                ? formatDate(
                    checkout.checkoutDate,
                  )

                : apartment.endDate
                  ? formatDate(
                      apartment.endDate,
                    )

                  : 'Open-ended'}
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
              Security deposit
            </Text>

            <Text
              style={
                styles.valueSmall
              }
            >
              {apartment.depositAmount !==
              undefined
                ? `${apartment.depositAmount} ${
                    apartment.depositCurrency ??
                    apartment.currency
                  }`

                : '—'}
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
              Agreement
            </Text>

            <Text
              style={
                styles.valueSmall
              }
            >
              {apartment.agreementPath
                ? 'Available'
                : 'Not attached'}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle
        title="Financial balance"
      />

      <Card>
        <View
          style={
            styles.balanceRow
          }
        >
          <Text
            style={
              styles.balanceLabel
            }
          >
            Outstanding
          </Text>

          <Text
            style={[
              styles.balanceValue,

              hasDebt &&
                styles.debtValue,
            ]}
          >
            {balance
              ? `${balance.outstanding.toLocaleString()} ${
                  balance.currency ??
                  apartment.currency
                }`

              : '—'}
          </Text>
        </View>

        <View
          style={
            styles.balanceRow
          }
        >
          <Text
            style={
              styles.balanceLabel
            }
          >
            Advance
          </Text>

          <Text
            style={
              styles.advanceValue
            }
          >
            {balance
              ? `${balance.advance.toLocaleString()} ${
                  balance.currency ??
                  apartment.currency
                }`

              : '—'}
          </Text>
        </View>

        {balance &&
        balance.openInvoices >
          0 ? (
          <Text
            style={
              styles.muted
            }
          >
            {balance.openInvoices}{' '}
            open invoice
            {balance.openInvoices ===
            1
              ? ''
              : 's'}
          </Text>
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
        apartment.meters.map(
          meter => {
            const latest =
              latestReadingText(
                meter,
              );

            const billingLines =
              billingLinesForMeter(
                meter,
                billing,
              );

            const submitted =
              isMeterValueSubmitted(
                meter,
                billing,
              );

            const variableLine =
              billingLines.find(
                line =>
                  line.kind ===
                  'VARIABLE',
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

                    {meter.billingMode ===
                    'METERED' ? (
                      <Text
                        style={
                          styles.muted
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
                    ) : null}

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
                    'VARIABLE' ? (
                      <Text
                        style={
                          styles.muted
                        }
                      >
                        {variableLine?.amount !==
                        undefined
                          ? `This month: ${formatMoney(
                              variableLine.amount,
                              variableLine.currency,
                            )}`

                          : 'Variable monthly expense not entered yet'}
                      </Text>
                    ) : null}
                  </View>

                  {checkoutPending &&
                  meter.billingMode ===
                    'METERED' ? (
                    <Badge
                      text="Final required"
                      tone="warning"
                    />
                  ) : (
                    <Badge
                      text={
                        serviceStatusText(
                          meter,
                          billing,
                        )
                      }
                      tone={
                        meter.billingMode ===
                        'FIXED'
                          ? 'neutral'
                          : submitted
                            ? 'success'
                            : 'warning'
                      }
                    />
                  )}
                </View>

                {meter.billingMode ===
                  'METERED' &&
                latest ? (
                  <View
                    style={
                      styles.latestBox
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      Last readings
                    </Text>

                    <Text
                      style={
                        styles.latestValue
                      }
                    >
                      {latest}
                    </Text>
                  </View>
                ) : null}

                {meter.billingMode ===
                'VARIABLE' ? (
                  <View
                    style={
                      styles.buttonTop
                    }
                  >
                    <SecondaryButton
                      title={
                        submitted
                          ? 'Edit expense'
                          : 'Enter expense'
                      }
                      onPress={() =>
                        navigation.navigate(
                          'VariableExpense',
                          {
                            tenancyId:
                              apartment.tenancyId,

                            propertyServiceId:
                              meter.serviceId,

                            serviceName:
                              meter.name,

                            currency:
                              meter.billingCurrency,

                            billingPeriod:
                              currentBillingPeriod(),
                          },
                        )
                      }
                    />
                  </View>
                ) : null}
              </Card>
            );
          },
        )
      )}

      {!checkoutPending &&
      metered.length >
        0 ? (
        <SecondaryButton
          title="Open readings"
          onPress={() =>
            navigation.navigate(
              'Readings',
              {
                tenancyId:
                  apartment.tenancyId,
              },
            )
          }
        />
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

    heroTitle: {
      color:
        colors.text,

      fontSize:
        21,

      fontWeight:
        '800',
    },

    title: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    checkoutTitle: {
      color:
        '#92400E',

      fontSize:
        16,

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

    area: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',

      marginTop:
        spacing.sm,
    },

    paymentWarning: {
      color:
        '#92400E',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '600',

      marginTop:
        spacing.md,
    },

    paymentTotalRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      marginTop:
        spacing.md,
    },

    disabledHint: {
      color:
        '#92400E',

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        spacing.sm,

      textAlign:
        'center',
    },

    paidHint: {
      color:
        '#166534',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '600',

      marginTop:
        spacing.md,
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

    balanceRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      marginBottom:
        10,
    },

    balanceLabel: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    balanceValue: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    debtValue: {
      color:
        '#B42318',
    },

    advanceValue: {
      color:
        colors.primary,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    latestBox: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,
    },

    latestValue: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',

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

    buttonTop: {
      marginTop:
        spacing.md,
    },
  });