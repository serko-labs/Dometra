import React, {
  useCallback,
  useMemo,
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
  Badge,
  Card,
  Header,
  Money,
  Screen,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  FinanceInvoiceSummary,
  loadPropertyInvoices,
} from '../services/financeRepository';

import {
  colors,
  spacing,
} from '../theme';

interface InvoiceListItem
  extends FinanceInvoiceSummary {
  propertyName:
    string;

  propertyAddress:
    string;
}

function formatDate(
  value?:
    string,
) {
  if (
    !value
  ) {
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
  status:
    string,
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

function statusText(
  status:
    string,
) {
  return status
    .replace(
      /_/g,
      ' ',
    )
    .toLowerCase()
    .replace(
      /^\w/,
      character =>
        character.toUpperCase(),
    );
}

export function InvoicesScreen() {
  const navigation =
    useNavigation<any>();

  const {
    state,
  } =
    useApp();

  const [
    invoices,
    setInvoices,
  ] =
    useState<
      InvoiceListItem[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const activeProperties =
    useMemo(
      () =>
        state.properties.filter(
          property =>
            property.status !==
            'ARCHIVED',
        ),
      [
        state.properties,
      ],
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
              const groups =
                await Promise.all(
                  activeProperties.map(
                    async property => {
                      const rows =
                        await loadPropertyInvoices(
                          property.id,
                        );

                      return rows.map(
                        invoice => ({
                          ...invoice,

                          propertyName:
                            property.name,

                          propertyAddress:
                            `${property.address}, ${property.city}`,
                        }),
                      );
                    },
                  ),
                );

              if (
                !active
              ) {
                return;
              }

              const result =
                groups
                  .flat()
                  .sort(
                    (
                      first,
                      second,
                    ) =>
                      second.billingPeriod.localeCompare(
                        first.billingPeriod,
                      ),
                  );

              setInvoices(
                result,
              );
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  'Invoices',

                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load invoices.',
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
        activeProperties,
      ],
    ),
  );

  return (
    <Screen>
      <Header
        title="Invoices"
        subtitle="Issued apartment invoices"
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading invoices...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      invoices.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No invoices yet
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Generate an invoice from an apartment to see it here.
          </Text>
        </Card>
      ) : null}

      {invoices.map(
        invoice => (
          <Pressable
            key={
              invoice.id
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
          >
            <Card>
              <View
                style={
                  styles.headerRow
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
                      invoice.propertyName
                    }
                  </Text>

                  <Text
                    style={
                      styles.address
                    }
                  >
                    {
                      invoice.propertyAddress
                    }
                  </Text>
                </View>

                <Badge
                  text={
                    statusText(
                      invoice.status,
                    )
                  }
                  tone={
                    statusTone(
                      invoice.status,
                    )
                  }
                />
              </View>

              <View
                style={
                  styles.separator
                }
              />

              <View
                style={
                  styles.row
                }
              >
                <View>
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Period
                  </Text>

                  <Text
                    style={
                      styles.value
                    }
                  >
                    {formatDate(
                      invoice.billingPeriod,
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.right
                  }
                >
                  <Text
                    style={
                      styles.label
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
              </View>

              <View
                style={
                  styles.balanceRow
                }
              >
                <Text
                  style={
                    styles.muted
                  }
                >
                  Paid:{' '}
                  {invoice.paid.toLocaleString()}{' '}
                  {invoice.baseCurrency}
                </Text>

                <Text
                  style={
                    invoice.balance >
                    0
                      ? styles.debt
                      : styles.paid
                  }
                >
                  {invoice.balance >
                  0
                    ? `Debt: ${invoice.balance.toLocaleString()} ${invoice.baseCurrency}`
                    : 'Paid'}
                </Text>
              </View>

              <Text
                style={
                  styles.invoiceNumber
                }
              >
                {
                  invoice.invoiceNumber
                }
                {' • '}
                due{' '}
                {formatDate(
                  invoice.dueDate,
                )}
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

    headerRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'flex-start',

      gap:
        spacing.md,
    },

    row: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    right: {
      alignItems:
        'flex-end',
    },

    propertyName: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    address: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        3,
    },

    label: {
      color:
        colors.muted,

      fontSize:
        10,

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
        '700',

      marginTop:
        3,
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
        15,

      fontWeight:
        '800',
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
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

      marginTop:
        spacing.sm,
    },

    debt: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    paid: {
      color:
        colors.primary,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    invoiceNumber: {
      color:
        colors.muted,

      fontSize:
        10,

      marginTop:
        spacing.sm,
    },
  });