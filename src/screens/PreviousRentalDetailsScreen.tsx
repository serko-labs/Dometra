import React, {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
  Linking,
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
  Header,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  loadTenantRentalHistoryDetails,
  RentalDepositAction,
  TenantRentalBalance,
  TenantRentalHistoryDetails,
} from '../services/tenantRentalHistoryRepository';

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

function depositActionLabel(
  action?:
    RentalDepositAction,
) {
  switch (
    action
  ) {
    case 'RETURNED':
      return 'Returned';

    case 'PARTIALLY_RETURNED':
      return 'Partially returned';

    case 'APPLIED':
      return 'Applied / kept';

    case 'WAIVED':
      return 'Waived';

    default:
      return '—';
  }
}

function hasOutstanding(
  balances:
    TenantRentalBalance[],
) {
  return balances.some(
    balance =>
      balance.outstanding >
      0.009,
  );
}

function InfoRow({
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
        styles.infoRow
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.value
        }
      >
        {value}
      </Text>
    </View>
  );
}

export function PreviousRentalDetailsScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const [
    rental,
    setRental,
  ] =
    useState<
      TenantRentalHistoryDetails | null
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
          const result =
            await loadTenantRentalHistoryDetails(
              tenancyId,
            );

          setRental(
            result,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Previous rental',

            error instanceof
            Error
              ? error.message
              : 'Unable to load rental details.',
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
        void reload();
      },

      [
        reload,
      ],
    ),
  );

  const openAgreement =
    async () => {
      if (
        !rental?.agreementUri
      ) {
        return;
      }

      try {
        await Linking.openURL(
          rental.agreementUri,
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Agreement',

          error instanceof
          Error
            ? error.message
            : 'Unable to open agreement.',
        );
      }
    };

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title="Previous rental"
          subtitle="Loading..."
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading rental details...
          </Text>
        </Card>
      </Screen>
    );
  }

  if (
    !rental
  ) {
    return (
      <Screen>
        <Header
          title="Previous rental"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            Rental not found
          </Text>
        </Card>
      </Screen>
    );
  }

  const outstanding =
    hasOutstanding(
      rental.balances,
    );

  return (
    <Screen>
      <Header
        title={
          rental.propertyName
        }
        subtitle={
          `${rental.propertyAddress}, ${rental.propertyCity}`
        }
        right={
          <Badge
            text={
              outstanding
                ? 'Outstanding'
                : 'Ended'
            }
            tone={
              outstanding
                ? 'warning'
                : 'neutral'
            }
          />
        }
      />

      <Card>
        <Text
          style={
            styles.heroTitle
          }
        >
          {
            rental.propertyName
          }
        </Text>

        <Text
          style={
            styles.address
          }
        >
          {
            rental.propertyAddress
          }
          ,{' '}
          {
            rental.propertyCity
          }
        </Text>

        {rental.areaM2 >
        0 ? (
          <Text
            style={
              styles.area
            }
          >
            {
              rental.areaM2
            }{' '}
            m²
          </Text>
        ) : null}

        <View
          style={
            styles.periodRow
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Started
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {formatDate(
                rental.startDate,
              )}
            </Text>
          </View>

          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Ended
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {formatDate(
                rental.endDate,
              )}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle
        title="Tenancy"
      />

      <Card>
        <InfoRow
          label="Rent"
          value={`${rental.rentAmount} ${rental.currency} / month`}
        />

        <InfoRow
          label="Payment due"
          value={`Day ${rental.paymentDueDay}`}
        />

        <InfoRow
          label="Security deposit"
          value={
            rental.depositAmount !==
            undefined
              ? `${rental.depositAmount} ${
                  rental.depositCurrency ??
                  rental.currency
                }`
              : '—'
          }
        />
      </Card>

      <SectionTitle
        title="Financial settlement"
      />

      <Card>
        {rental.balances.length ===
        0 ? (
          <Text
            style={
              styles.muted
            }
          >
            No invoices were recorded for this tenancy.
          </Text>
        ) : (
          rental.balances.map(
            balance => (
              <View
                key={
                  balance.currency
                }
                style={
                  styles.balanceBlock
                }
              >
                <View
                  style={
                    styles.balanceHeader
                  }
                >
                  <Text
                    style={
                      styles.currency
                    }
                  >
                    {
                      balance.currency
                    }
                  </Text>

                  <Badge
                    text={
                      balance.outstanding >
                      0.009
                        ? 'Outstanding'
                        : 'Settled'
                    }
                    tone={
                      balance.outstanding >
                      0.009
                        ? 'warning'
                        : 'success'
                    }
                  />
                </View>

                <InfoRow
                  label="Invoiced"
                  value={
                    money(
                      balance.invoiced,
                      balance.currency,
                    )
                  }
                />

                <InfoRow
                  label="Paid"
                  value={
                    money(
                      balance.paid,
                      balance.currency,
                    )
                  }
                />

                <InfoRow
                  label="Outstanding"
                  value={
                    money(
                      balance.outstanding,
                      balance.currency,
                    )
                  }
                />
              </View>
            ),
          )
        )}

        <View
          style={
            styles.buttonTop
          }
        >
          <SecondaryButton
            title="Billing history"
            onPress={() =>
              navigation.navigate(
                'BillingHistory',
                {
                  tenancyId:
                    rental.tenancyId,

                  propertyName:
                    rental.propertyName,

                  mode:
                    'TENANT',
                },
              )
            }
          />
        </View>
      </Card>

      <SectionTitle
        title="Checkout"
      />

      <Card>
        {rental.checkout ? (
          <>
            <InfoRow
              label="Move-out date"
              value={
                formatDate(
                  rental.checkout
                    .checkoutDate,
                )
              }
            />

            <InfoRow
              label="Deposit settlement"
              value={
                depositActionLabel(
                  rental.checkout
                    .depositAction,
                )
              }
            />

            {rental.checkout
              .depositReturnAmount !==
            undefined ? (
              <InfoRow
                label="Deposit returned"
                value={
                  `${rental.checkout.depositReturnAmount} ${
                    rental.depositCurrency ??
                    rental.currency
                  }`
                }
              />
            ) : null}

            {rental.checkout
              .settlementNotes ? (
              <View
                style={
                  styles.notesBox
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  Settlement notes
                </Text>

                <Text
                  style={
                    styles.notes
                  }
                >
                  {
                    rental.checkout
                      .settlementNotes
                  }
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text
            style={
              styles.muted
            }
          >
            This tenancy was ended without a recorded Dometra checkout.
          </Text>
        )}
      </Card>

      <SectionTitle
        title="Final meter readings"
      />

      {rental.finalReadings.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No final checkout meter readings were recorded.
          </Text>
        </Card>
      ) : (
        <Card>
          {rental.finalReadings.map(
            reading => (
              <View
                key={
                  reading.id
                }
                style={
                  styles.readingRow
                }
              >
                <View
                  style={
                    styles.flex
                  }
                >
                  <Text
                    style={
                      styles.readingTitle
                    }
                  >
                    {
                      reading.meterName
                    }

                    {reading.registerCode
                      ? ` · ${reading.registerCode}`
                      : ''}
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {
                      reading.registerName
                    }
                    {' · '}
                    {formatDate(
                      reading.readingDate,
                    )}
                  </Text>
                </View>

                <Text
                  style={
                    styles.readingValue
                  }
                >
                  {
                    reading.value
                  }{' '}
                  {
                    reading.unit
                  }
                </Text>
              </View>
            ),
          )}
        </Card>
      )}

      <SectionTitle
        title="Documents"
      />

      <Card>
        <View
          style={
            styles.documentRow
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
              Rental agreement
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              {rental.agreementPath
                ? 'Agreement is attached to this tenancy.'
                : 'No agreement was attached.'}
            </Text>
          </View>

          <Badge
            text={
              rental.agreementPath
                ? 'Available'
                : 'Missing'
            }
            tone={
              rental.agreementPath
                ? 'success'
                : 'neutral'
            }
          />
        </View>

        {rental.agreementUri ? (
          <View
            style={
              styles.buttonTop
            }
          >
            <SecondaryButton
              title="Open agreement"
              onPress={() =>
                void openAgreement()
              }
            />
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex:
        1,
    },

    heroTitle: {
      color:
        colors.text,

      fontSize:
        21,

      fontWeight:
        '900',
    },

    title: {
      color:
        colors.text,

      fontSize:
        15,

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

    periodRow: {
      flexDirection:
        'row',

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

    infoRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

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
      flexShrink:
        1,

      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '800',

      textAlign:
        'right',
    },

    balanceBlock: {
      marginBottom:
        spacing.md,
    },

    balanceHeader: {
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
        17,

      fontWeight:
        '900',
    },

    notesBox: {
      marginTop:
        spacing.md,
    },

    notes: {
      color:
        colors.text,

      fontSize:
        13,

      lineHeight:
        19,

      marginTop:
        5,
    },

    readingRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      paddingVertical:
        10,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    readingTitle: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    readingValue: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    documentRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        3,
    },
  });