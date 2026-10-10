import React from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  useMutation,
  useQuery,
} from '@tanstack/react-query';

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
  CheckoutBalance,
  generateCheckoutFinalInvoice,
  loadCheckoutFinalBilling,
} from '../services/checkoutFinalBillingRepository';

import {
  invalidateCheckoutData,
  queryKeys,
} from '../lib/queryClient';

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
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  )} ${currency}`;
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
      value.includes(
        'T',
      )
        ? value
        : `${value}T00:00:00`,
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


function errorMessage(
  error:
    unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      'object' &&
    'message' in error
  ) {
    return String(
      (
        error as {
          message:
            unknown;
        }
      ).message,
    );
  }

  return 'Unknown error.';
}


function BalanceRows({
  items,
  emptyText,
}: {
  items:
    CheckoutBalance[];

  emptyText:
    string;
}) {
  if (
    items.length ===
    0
  ) {
    return (
      <Text
        style={
          styles.muted
        }
      >
        {emptyText}
      </Text>
    );
  }


  return (
    <>
      {items.map(
        item => (
          <View
            key={
              item.currency
            }
            style={
              styles.moneyRow
            }
          >
            <Text
              style={
                styles.moneyCurrency
              }
            >
              {
                item.currency
              }
            </Text>

            <Text
              style={
                styles.moneyValue
              }
            >
              {money(
                item.outstanding,
                item.currency,
              )}
            </Text>
          </View>
        ),
      )}
    </>
  );
}


export function CheckoutFinalBillScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const propertyId =
    route.params
      ?.propertyId as
      | string
      | undefined;

  const propertyName =
    route.params
      ?.propertyName as
      | string
      | undefined;


  const {
    data:
      summary,

    error,

    isPending,

    isFetching,

    refetch,
  } =
    useQuery({
      queryKey:
        queryKeys.checkoutFinalBill(
          tenancyId,
        ),

      queryFn:
        () =>
          loadCheckoutFinalBilling(
            tenancyId,
          ),

      enabled:
        Boolean(
          tenancyId,
        ),
    });


  const generateMutation =
    useMutation({
      mutationFn:
        () =>
          generateCheckoutFinalInvoice(
            tenancyId,
          ),

      onSuccess:
        async () => {
          await invalidateCheckoutData(
            tenancyId,
            propertyId,
          );

          Alert.alert(
            'Final bill confirmed',
            'The final checkout adjustment has been issued.',
          );
        },

      onError:
        mutationError => {
          Alert.alert(
            'Unable to create final invoice',

            errorMessage(
              mutationError,
            ),
          );
        },
    });


  const continueCheckout =
    () => {
      navigation.navigate(
        'CheckoutSettlement',
        {
          tenancyId,

          propertyId,

          propertyName,
        },
      );
    };


  if (
    isPending
  ) {
    return (
      <Screen>
        <Header
          title="Final checkout bill"
          subtitle={
            propertyName ??
            'Loading...'
          }
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Calculating final meter charges...
          </Text>
        </Card>
      </Screen>
    );
  }


  if (
    error ||
    !summary
  ) {
    return (
      <Screen>
        <Header
          title="Final checkout bill"
          subtitle={
            propertyName
          }
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            Final bill is not available.
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {error
              ? errorMessage(
                  error,
                )
              : 'No billing information was returned.'}
          </Text>
        </Card>

        <SecondaryButton
          title={
            isFetching
              ? 'Refreshing...'
              : 'Try again'
          }
          onPress={() => {
            if (
              !isFetching
            ) {
              void refetch();
            }
          }}
        />
      </Screen>
    );
  }


  const generated =
    Boolean(
      summary.generatedAt,
    );


  return (
    <Screen>
      <Header
        title="Final checkout bill"
        subtitle={
          propertyName ??
          (
            summary.checkoutDate
              ? `Checkout ${formatDate(
                  summary.checkoutDate,
                )}`
              : 'Checkout'
          )
        }
        right={
          <Badge
            text={
              generated
                ? 'Issued'
                : summary.ready
                  ? 'Ready'
                  : 'Incomplete'
            }
            tone={
              generated
                ? 'success'
                : 'warning'
            }
          />
        }
      />


      <Card>
        <Text
          style={
            styles.introTitle
          }
        >
          Final meter adjustment
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          This bill contains only consumption between the last regular meter reading and the tenant's final move-out reading.
        </Text>

        <View
          style={
            styles.infoTop
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Checkout date
          </Text>

          <Text
            style={
              styles.value
            }
          >
            {formatDate(
              summary.checkoutDate,
            )}
          </Text>
        </View>
      </Card>


      <SectionTitle
        title="Final meter readings"
      />


      {summary.lines.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No active metered utilities require a final adjustment.
          </Text>
        </Card>
      ) : (
        summary.lines.map(
          line => (
            <Card
              key={
                line.meterRegisterId
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
                      styles.lineTitle
                    }
                  >
                    {
                      line.serviceName
                    }
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {
                      line.registerName
                    }

                    {line.registerCode
                      ? ` · ${line.registerCode}`
                      : ''}
                  </Text>
                </View>

                <Badge
                  text={
                    line.ready
                      ? 'Ready'
                      : 'Check'
                  }
                  tone={
                    line.ready
                      ? 'success'
                      : 'warning'
                  }
                />
              </View>


              <View
                style={
                  styles.readingGrid
                }
              >
                <View
                  style={
                    styles.readingCell
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Previous
                  </Text>

                  <Text
                    style={
                      styles.value
                    }
                  >
                    {line.previousValue ??
                      '—'}{' '}
                    {
                      line.unit
                    }
                  </Text>
                </View>


                <View
                  style={
                    styles.readingCell
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Final
                  </Text>

                  <Text
                    style={
                      styles.value
                    }
                  >
                    {line.finalValue ??
                      '—'}{' '}
                    {
                      line.unit
                    }
                  </Text>
                </View>


                <View
                  style={
                    styles.readingCell
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Usage
                  </Text>

                  <Text
                    style={
                      styles.value
                    }
                  >
                    {line.consumption ??
                      '—'}{' '}
                    {
                      line.unit
                    }
                  </Text>
                </View>
              </View>


              {line.ready &&
              line.amount !==
                undefined &&
              line.currencyCode ? (
                <View
                  style={
                    styles.chargeRow
                  }
                >
                  <Text
                    style={
                      styles.chargeHint
                    }
                  >
                    {line.unitPrice ??
                      0}{' '}
                    {
                      line.currencyCode
                    }
                    {' / '}
                    {
                      line.unit
                    }
                  </Text>

                  <Text
                    style={
                      styles.chargeValue
                    }
                  >
                    {money(
                      line.amount,
                      line.currencyCode,
                    )}
                  </Text>
                </View>
              ) : null}


              {line.issue ? (
                <View
                  style={
                    styles.issueBox
                  }
                >
                  <Text
                    style={
                      styles.issueText
                    }
                  >
                    {
                      line.issue
                    }
                  </Text>
                </View>
              ) : null}
            </Card>
          ),
        )
      )}


      <SectionTitle
        title="Final meter charges"
      />

      <Card>
        <BalanceRows
          items={
            summary.totals
          }
          emptyText="No additional meter charges."
        />
      </Card>


      <SectionTitle
        title="Existing outstanding balance"
      />

      <Card>
        <BalanceRows
          items={
            summary.existingOutstanding
          }
          emptyText="No existing outstanding invoices."
        />

        <Text
          style={
            styles.balanceHint
          }
        >
          Existing rent and utility invoices are not duplicated in the final adjustment.
        </Text>
      </Card>


      {generated ? (
        <>
          <SectionTitle
            title="Final invoice"
          />

          <Card>
            {summary.invoices.length ===
            0 ? (
              <Text
                style={
                  styles.muted
                }
              >
                Final billing was confirmed. No additional invoice was required because the final meter adjustment is zero.
              </Text>
            ) : (
              summary.invoices.map(
                invoice => (
                  <View
                    key={
                      invoice.id
                    }
                    style={
                      styles.moneyRow
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.lineTitle
                        }
                      >
                        Checkout adjustment
                      </Text>

                      <Text
                        style={
                          styles.muted
                        }
                      >
                        Issued
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.moneyValue
                      }
                    >
                      {money(
                        invoice.total,
                        invoice.currency,
                      )}
                    </Text>
                  </View>
                ),
              )
            )}
          </Card>


          <PrimaryButton
            title="Continue to deposit settlement"
            onPress={
              continueCheckout
            }
          />
        </>
      ) : (
        <>
          {!summary.ready ? (
            <Card>
              <Text
                style={
                  styles.issueTitle
                }
              >
                Final bill is not ready
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                Resolve the highlighted meter readings or tariffs before completing checkout.
              </Text>
            </Card>
          ) : null}


          {summary.ready ? (
            <PrimaryButton
              title={
                generateMutation.isPending
                  ? 'Creating final invoice...'
                  : 'Confirm final bill'
              }
              onPress={() => {
                if (
                  !generateMutation.isPending
                ) {
                  generateMutation.mutate();
                }
              }}
            />
          ) : null}


          <SecondaryButton
            title="Back"
            onPress={() =>
              navigation.goBack()
            }
          />
        </>
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

    rowBetween: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'flex-start',

      gap:
        spacing.md,
    },

    introTitle: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '900',
    },

    title: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    lineTitle: {
      color:
        colors.text,

      fontSize:
        14,

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

    infoTop: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,
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
        '800',

      marginTop:
        4,
    },

    readingGrid: {
      flexDirection:
        'row',

      gap:
        spacing.sm,

      marginTop:
        spacing.md,
    },

    readingCell: {
      flex:
        1,
    },

    chargeRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

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

    chargeHint: {
      color:
        colors.muted,

      fontSize:
        11,
    },

    chargeValue: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '900',
    },

    issueBox: {
      backgroundColor:
        '#FFF7ED',

      borderRadius:
        12,

      padding:
        12,

      marginTop:
        spacing.md,
    },

    issueTitle: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    issueText: {
      color:
        '#9A3412',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '700',
    },

    moneyRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      paddingVertical:
        8,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    moneyCurrency: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    moneyValue: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '900',
    },

    balanceHint: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        spacing.md,
    },
  });