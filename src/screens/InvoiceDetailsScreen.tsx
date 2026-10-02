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
  Badge,
  Card,
  Divider,
  Header,
  Money,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  FinanceInvoiceDetails,
  loadInvoiceDetails,
} from '../services/financeRepository';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  value?: string,
) {
  if (!value) {
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

function statusTone(
  status: string,
) {
  if (
    status ===
    'PAID'
  ) {
    return 'success' as const;
  }

  if (
    status ===
      'OVERDUE' ||
    status ===
      'PARTIALLY_PAID'
  ) {
    return 'warning' as const;
  }

  return 'neutral' as const;
}

function lineDetails(
  invoice:
    FinanceInvoiceDetails,

  line:
    FinanceInvoiceDetails['lines'][number],
) {
  const parts:
    string[] = [];

  if (
    line.quantity !==
    undefined
  ) {
    const quantity =
      `${line.quantity.toLocaleString()}${
        line.unit
          ? ` ${line.unit}`
          : ''
      }`;

    parts.push(
      quantity,
    );
  }

  if (
    line.unitPrice !==
    undefined
  ) {
    parts.push(
      `${line.unitPrice.toLocaleString()} ${line.currency}${
        line.unit
          ? `/${line.unit}`
          : ''
      }`,
    );
  }

  if (
    line.currency !==
    invoice.baseCurrency
  ) {
    parts.push(
      `Base ${line.baseAmount.toLocaleString()} ${invoice.baseCurrency}`,
    );
  }

  return parts.join(
    ' • ',
  );
}

export function InvoiceDetailsScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    state,
  } =
    useApp();

  const invoiceId =
    route.params
      ?.invoiceId as
      | string
      | undefined;

  const [
    invoice,
    setInvoice,
  ] =
    useState<
      FinanceInvoiceDetails | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useFocusEffect(
    useCallback(
      () => {
        if (!invoiceId) {
          setLoading(
            false,
          );

          return;
        }

        let active =
          true;

        const load =
          async () => {
            setLoading(
              true,
            );

            try {
              const result =
                await loadInvoiceDetails(
                  invoiceId,
                );

              if (active) {
                setInvoice(
                  result,
                );
              }
            } catch (error) {
              if (active) {
                Alert.alert(
                  'Invoice',
                  error instanceof Error
                    ? error.message
                    : 'Unable to load invoice.',
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
        invoiceId,
      ],
    ),
  );

  if (loading) {
    return (
      <Screen>
        <Header
          title="Invoice"
          subtitle="Loading invoice..."
        />
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen>
        <Header
          title="Invoice"
          subtitle="Invoice not found"
        />
      </Screen>
    );
  }

  const property =
    state.properties.find(
      item =>
        item.id ===
        invoice.propertyId,
    );

  return (
    <Screen>
      <Header
        title={
          invoice.invoiceNumber
        }
        subtitle={
          property
            ? `${property.name} • ${formatDate(
                invoice.billingPeriod,
              )}`
            : formatDate(
                invoice.billingPeriod,
              )
        }
        right={
          <Badge
            text={
              invoice.status
            }
            tone={
              statusTone(
                invoice.status,
              )
            }
          />
        }
      />

      <Card>
        <View
          style={
            styles.rowBetween
          }
        >
          <Text
            style={
              styles.muted
            }
          >
            Issue date
          </Text>

          <Text
            style={
              styles.value
            }
          >
            {formatDate(
              invoice.issueDate,
            )}
          </Text>
        </View>

        <Divider />

        <View
          style={
            styles.rowBetween
          }
        >
          <Text
            style={
              styles.muted
            }
          >
            Due date
          </Text>

          <Text
            style={
              styles.value
            }
          >
            {formatDate(
              invoice.dueDate,
            )}
          </Text>
        </View>
      </Card>

      <SectionTitle
        title="Charges"
      />

      <Card>
        {invoice.lines.length ===
        0 ? (
          <Text
            style={
              styles.muted
            }
          >
            This invoice has no lines.
          </Text>
        ) : null}

        {invoice.lines.map(
          (
            line,
            index,
          ) => {
            const details =
              lineDetails(
                invoice,
                line,
              );

            return (
              <View
                key={
                  line.id
                }
              >
                {index >
                0 ? (
                  <Divider />
                ) : null}

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
                      {line.description}
                    </Text>

                    {details ? (
                      <Text
                        style={
                          styles.muted
                        }
                      >
                        {details}
                      </Text>
                    ) : null}
                  </View>

                  <Money
                    amount={
                      line.amount
                    }
                    currency={
                      line.currency
                    }
                    strong
                  />
                </View>
              </View>
            );
          },
        )}
      </Card>

      <SectionTitle
        title="Balance"
      />

      <Card>
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
            Total
          </Text>

          <Money
            amount={
              invoice.total
            }
            currency={
              invoice.baseCurrency
            }
            strong
          />
        </View>

        <Divider />

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
            Paid
          </Text>

          <Money
            amount={
              invoice.paid
            }
            currency={
              invoice.baseCurrency
            }
            strong
          />
        </View>

        <Divider />

        <View
          style={
            styles.totalRow
          }
        >
          <Text
            style={[
              styles.totalLabel,

              invoice.balance >
                0 &&
                styles.debtLabel,
            ]}
          >
            Debt
          </Text>

          <Money
            amount={
              invoice.balance
            }
            currency={
              invoice.baseCurrency
            }
            strong
          />
        </View>
      </Card>

      <PrimaryButton
        title="Add payment"
        onPress={() =>
          navigation.navigate(
            'AddPayment',
            {
              propertyId:
                invoice.propertyId,
            },
          )
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

    flex: {
      flex:
        1,
    },

    muted: {
      color:
        colors.muted,
      fontSize:
        12,
      lineHeight:
        18,
    },

    value: {
      color:
        colors.text,
      fontSize:
        15,
      fontWeight:
        '700',
    },

    totalRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginVertical:
        4,
      gap:
        spacing.md,
    },

    totalLabel: {
      color:
        colors.muted,
      fontWeight:
        '700',
    },

    debtLabel: {
      color:
        colors.text,
    },
  });