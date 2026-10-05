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
  SubmissionStatusBadge,
} from '../components/SubmissionStatusBadge';

import {
  loadCheckoutSummaries,
  TenancyCheckout,
} from '../services/checkoutRepository';

import {
  getApartmentSubmissionStatus,
} from '../services/meterSubmissionStatus';

import {
  loadTenantApartments,
  TenantApartmentPortal,
} from '../services/tenantPortalRepository';

import {
  colors,
  spacing,
} from '../theme';

function submissionText(
  state:
    ReturnType<
      typeof getApartmentSubmissionStatus
    >['state'],

  submitted:
    number,

  total:
    number,
) {
  if (
    state ===
    'COMPLETE'
  ) {
    return total >
      0
      ? `${submitted}/${total} submitted`
      : 'Submitted';
  }

  if (
    state ===
    'DUE'
  ) {
    return total >
      0
      ? `${submitted}/${total} submitted`
      : 'Readings due';
  }

  if (
    state ===
    'OVERDUE'
  ) {
    return total >
      0
      ? `${submitted}/${total} overdue`
      : 'Overdue';
  }

  return 'No readings required';
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

              const checkoutData =
                await loadCheckoutSummaries(
                  data.map(
                    apartment =>
                      apartment.tenancyId,
                  ),
                );

              if (
                active
              ) {
                setApartments(
                  data,
                );

                setCheckouts(
                  checkoutData,
                );
              }
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

                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load your apartments.',
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
            {t(
              'loadingApartments',

              {
                defaultValue:
                  'Loading apartments...',
              },
            )}
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
            {t(
              'noActiveTenancy',

              {
                defaultValue:
                  'No active tenancy',
              },
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'tenantHomeEmpty',

              {
                defaultValue:
                  'When you accept an apartment invitation, it will appear here.',
              },
            )}
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

          const submission =
            getApartmentSubmissionStatus(
              apartment.meters,
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
                      text={t(
                        'checkoutPending',

                        {
                          defaultValue:
                            'Checkout',
                        },
                      )}
                      tone="warning"
                    />
                  ) : (
                    <SubmissionStatusBadge
                      state={
                        submission.state
                      }
                      text={submissionText(
                        submission.state,
                        submission.submittedMeters,
                        submission.totalMeters,
                      )}
                    />
                  )}
                </View>

                <View
                  style={
                    styles.footer
                  }
                >
                  {checkoutPending ? (
                    <Text
                      style={
                        styles.checkoutHint
                      }
                    >
                      {t(
                        'checkoutFinalReadingsRequired',

                        {
                          defaultValue:
                            'Checkout is in progress. Submit final meter readings.',
                        },
                      )}
                    </Text>
                  ) : null}

                  {!checkoutPending &&
                  submission.state ===
                    'DUE' ? (
                    <Text
                      style={
                        styles.dueHint
                      }
                    >
                      {t(
                        'tenantReadingsDueHint',

                        {
                          defaultValue:
                            'Send meter readings by the 5th.',
                        },
                      )}
                    </Text>
                  ) : null}

                  {!checkoutPending &&
                  submission.state ===
                    'OVERDUE' ? (
                    <Text
                      style={
                        styles.overdueHint
                      }
                    >
                      {t(
                        'tenantReadingsOverdueHint',

                        {
                          defaultValue:
                            'Meter readings are overdue.',
                        },
                      )}
                    </Text>
                  ) : null}

                  {!checkoutPending &&
                  submission.state ===
                    'COMPLETE' ? (
                    <Text
                      style={
                        styles.completeHint
                      }
                    >
                      {t(
                        'tenantReadingsCompleteHint',

                        {
                          defaultValue:
                            'All readings for this month are submitted.',
                        },
                      )}
                    </Text>
                  ) : null}

                  {!checkoutPending &&
                  submission.state ===
                    'NOT_REQUIRED' ? (
                    <Text
                      style={
                        styles.muted
                      }
                    >
                      {t(
                        'tenantNoReadingsRequired',

                        {
                          defaultValue:
                            'No meter readings are required for this apartment.',
                        },
                      )}
                    </Text>
                  ) : null}

                  <Text
                    style={
                      styles.openText
                    }
                  >
                    {t(
                      'openDetails',

                      {
                        defaultValue:
                          'Open details',
                      },
                    )}{' '}
                    ›
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