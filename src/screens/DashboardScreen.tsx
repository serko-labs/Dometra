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
  Badge,
  Card,
  Header,
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  LandlordPortfolioStatistics,
  LandlordPropertyPaymentSummary,
  loadLandlordPortfolioStatistics,
} from '../services/landlordPortfolioRepository';

import {
  colors,
  spacing,
} from '../theme';

function paymentBadge(
  property:
    LandlordPropertyPaymentSummary,
) {
  if (
    property.paymentState ===
    'VACANT'
  ) {
    return (
      <Badge
        text="Vacant"
        tone="neutral"
      />
    );
  }

  if (
    property.paymentState ===
    'PAID'
  ) {
    return (
      <PaymentStatusBadge
        state="PAID"
        text="Paid"
      />
    );
  }

  if (
    property.paymentState ===
    'DELAYED'
  ) {
    return (
      <PaymentStatusBadge
        state="OVERDUE"
        text="Delayed"
      />
    );
  }

  return (
    <PaymentStatusBadge
      state="DUE"
      text="Pending"
    />
  );
}

function rentText(
  property:
    LandlordPropertyPaymentSummary,
) {
  if (
    property.rentAmount ===
      undefined ||
    !property.rentCurrency
  ) {
    return '—';
  }

  return `${property.rentAmount.toLocaleString(
    undefined,
    {
      maximumFractionDigits:
        2,
    },
  )} ${property.rentCurrency}`;
}

export function DashboardScreen() {
  const navigation =
    useNavigation<any>();

  const [
    portfolio,
    setPortfolio,
  ] =
    useState<
      LandlordPortfolioStatistics | null
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
          const data =
            await loadLandlordPortfolioStatistics();

          setPortfolio(
            data,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Home',

            error instanceof
            Error
              ? error.message
              : 'Unable to load your properties.',
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
        title="Home"
        subtitle="Your rental properties"
      />

      <PrimaryButton
        title="+ Add property"
        onPress={() =>
          navigation.navigate(
            'AddProperty',
          )
        }
      />

      <View
        style={
          styles.sectionSpacer
        }
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading properties...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      portfolio &&
      portfolio.properties.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No properties yet
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Add your first apartment to start managing tenants, readings and monthly payments.
          </Text>
        </Card>
      ) : null}

      {!loading &&
      portfolio ? (
        portfolio.properties.map(
          property => (
            <Pressable
              key={
                property.propertyId
              }
              onPress={() =>
                navigation.navigate(
                  'PropertyDetails',
                  {
                    propertyId:
                      property.propertyId,
                  },
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
                        property.propertyName
                      }
                    </Text>

                    <Text
                      style={
                        styles.address
                      }
                    >
                      {
                        property.propertyAddress
                      }
                      ,{' '}
                      {
                        property.propertyCity
                      }
                    </Text>
                  </View>

                  {paymentBadge(
                    property,
                  )}
                </View>

                <View
                  style={
                    styles.separator
                  }
                />

                {property.tenancyId ? (
                  <>
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
                          {rentText(
                            property,
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
                          Payment due
                        </Text>

                        <Text
                          style={
                            styles.value
                          }
                        >
                          Day{' '}
                          {property.paymentDueDay ??
                            5}
                        </Text>
                      </View>
                    </View>

                    {!property.billingReady ? (
                      <Text
                        style={
                          styles.billingHint
                        }
                      >
                        {property.billingMissingCount}{' '}
                        billing item
                        {property.billingMissingCount ===
                        1
                          ? ''
                          : 's'}{' '}
                        still need data for this month.
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text
                    style={
                      styles.muted
                    }
                  >
                    No active tenant. Open the apartment to add or invite a tenant.
                  </Text>
                )}

                <Text
                  style={
                    styles.openText
                  }
                >
                  Open apartment ›
                </Text>
              </Card>
            </Pressable>
          ),
        )
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

    sectionSpacer: {
      height:
        spacing.md,
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

    propertyName: {
      color:
        colors.text,

      fontSize:
        18,

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
        spacing.md,
    },

    infoGrid: {
      flexDirection:
        'row',

      gap:
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
        15,

      fontWeight:
        '800',

      marginTop:
        4,
    },

    billingHint: {
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