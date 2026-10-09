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
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  NotificationBell,
} from '../components/NotificationBell';

import {
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  currentBillingPeriod,
  getTenantPaymentState,
  loadPaymentClaims,
  TenantPaymentClaim,
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
  loadTenantRentalHistory,
  TenantRentalHistoryItem,
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
      month:
        'short',

      year:
        'numeric',
    },
  );
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
    previousRentals,
    setPreviousRentals,
  ] =
    useState<
      TenantRentalHistoryItem[]
    >([]);

  const [
    paymentClaims,
    setPaymentClaims,
  ] =
    useState<
      Record<
        string,
        TenantPaymentClaim
      >
    >({});

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
          const [
            apartmentData,
            rentalHistory,
          ] =
            await Promise.all([
              loadTenantApartments(),

              loadTenantRentalHistory(),
            ]);

          const tenancyIds =
            apartmentData.map(
              apartment =>
                apartment.tenancyId,
            );

          const [
            claims,
            checkoutData,
          ] =
            await Promise.all([
              loadPaymentClaims(
                tenancyIds,
                currentBillingPeriod(),
              ),

              loadCheckoutSummaries(
                tenancyIds,
              ),
            ]);

          setApartments(
            apartmentData,
          );

          setPreviousRentals(
            rentalHistory,
          );

          setPaymentClaims(
            claims,
          );

          setCheckouts(
            checkoutData,
          );
        } catch (
          error
        ) {
          Alert.alert(
            t(
              'home',
              {
                defaultValue:
                  'Home',
              },
            ),

            error instanceof
            Error
              ? error.message
              : 'Unable to load your apartments.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
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

  const openApartment =
    (
      apartment:
        TenantApartmentPortal,
    ) => {
      navigation
        .getParent()
        ?.navigate(
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
        right={
          <NotificationBell />
        }
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
            When you accept a new apartment invitation, it will appear here.
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
            'PENDING';

          const claim =
            paymentClaims[
              apartment.tenancyId
            ] ??
            null;

          const paymentState =
            getTenantPaymentState(
              claim,

              currentBillingPeriod(),

              apartment.paymentDueDay,
            );

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

                  {checkoutPending ? (
                    <Badge
                      text="Checkout"
                      tone="warning"
                    />
                  ) : (
                    <PaymentStatusBadge
                      state={
                        paymentState
                      }
                      text={
                        paymentState ===
                        'PAID'
                          ? 'Paid'

                          : paymentState ===
                              'AWAITING'
                            ? 'Awaiting'

                            : paymentState ===
                                'OVERDUE'
                              ? 'Overdue'

                              : 'Pending'
                      }
                    />
                  )}
                </View>

                <View
                  style={
                    styles.infoRow
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

                <Text
                  style={
                    styles.openText
                  }
                >
                  Open details ›
                </Text>
              </Card>
            </Pressable>
          );
        },
      )}

      {!loading &&
      previousRentals.length >
        0 ? (
        <>
          <SectionTitle
            title="Previous rentals"
          />

          <Card>
            <View
              style={
                styles.previousHeader
              }
            >
              <View
                style={
                  styles.historyIcon
                }
              >
                <Text
                  style={
                    styles.historyIconText
                  }
                >
                  ↶
                </Text>
              </View>

              <View
                style={
                  styles.flex
                }
              >
                <Text
                  style={
                    styles.historyTitle
                  }
                >
                  Previous rentals
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  {previousRentals.length}{' '}
                  completed rental
                  {previousRentals.length ===
                  1
                    ? ''
                    : 's'}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.latestRental
              }
            >
              <Text
                style={
                  styles.latestRentalName
                }
              >
                {
                  previousRentals[0]
                    .propertyName
                }
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                {formatDate(
                  previousRentals[0]
                    .startDate,
                )}
                {' → '}
                {formatDate(
                  previousRentals[0]
                    .endDate,
                )}
              </Text>
            </View>

            <View
              style={
                styles.buttonTop
              }
            >
              <SecondaryButton
                title="View previous rentals"
                onPress={() =>
                  navigation
                    .getParent()
                    ?.navigate(
                      'PreviousRentals',
                    )
                }
              />
            </View>
          </Card>
        </>
      ) : null}
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

    infoRow: {
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

    previousHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    historyIcon: {
      width:
        44,

      height:
        44,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EEF2FF',
    },

    historyIconText: {
      color:
        colors.primary,

      fontSize:
        23,

      fontWeight:
        '800',
    },

    historyTitle: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    latestRental: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,
    },

    latestRentalName: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '800',
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