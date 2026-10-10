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
  PropertyTypeIcon,
} from '../components/PropertyTypeIcon';

import {
  SubmissionStatusBadge,
} from '../components/SubmissionStatusBadge';

import {
  loadTenantFinanceBalances,
  TenantFinanceBalance,
} from '../services/financeRepository';

import {
  getApartmentSubmissionStatus,
  getMeterSubmissionStatus,
} from '../services/meterSubmissionStatus';

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

function meterStatusText(
  meter:
    Meter,
) {
  const status =
    getMeterSubmissionStatus(
      meter,
    );

  if (
    status.state ===
    'COMPLETE'
  ) {
    return status.totalRegisters >
      1
      ? `${status.submittedRegisters}/${status.totalRegisters} submitted`
      : 'Submitted';
  }

  if (
    status.state ===
    'DUE'
  ) {
    return 'Due';
  }

  if (
    status.state ===
    'OVERDUE'
  ) {
    return 'Overdue';
  }

  return 'Not required';
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

  const tenancyId:
    string | undefined =
      route.params
        ?.tenancyId;

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

              const finance =
                await loadTenantFinanceBalances(
                  [
                    selected.tenancyId,
                  ],
                );

              if (
                active
              ) {
                setApartment(
                  selected,
                );

                setBalance(
                  finance[0] ??
                    null,
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
                    'apartment',
                    {
                      defaultValue:
                        'Apartment',
                    },
                  ),

                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load apartment.',
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
        tenancyId,
        t,
      ],
    ),
  );

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title={t(
            'apartment',
            {
              defaultValue:
                'Apartment',
            },
          )}
          subtitle={t(
            'loadingApartment',
            {
              defaultValue:
                'Loading apartment...',
            },
          )}
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            {t(
              'loadingApartment',
              {
                defaultValue:
                  'Loading apartment...',
              },
            )}
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
          title={t(
            'apartment',
            {
              defaultValue:
                'Apartment',
            },
          )}
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            {t(
              'apartmentNotFound',
              {
                defaultValue:
                  'Apartment not found',
              },
            )}
          </Text>
        </Card>
      </Screen>
    );
  }

  const checkoutPending =
    apartment.status ===
    'CHECKOUT_PENDING';

  const apartmentStatus =
    getApartmentSubmissionStatus(
      apartment.meters,
    );

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

  return (
    <Screen>
      <Header
        title={
          apartment.propertyName
        }
        subtitle={`${apartment.propertyAddress}, ${apartment.propertyCity}`}
      />

      <Card>
        <View
          style={
            styles.rowBetween
          }
        >
          <View
            style={
              styles.propertyIdentity
            }
          >
            <PropertyTypeIcon
              propertyType={
                apartment.propertyType
              }
              size="large"
            />

            <View
              style={
                styles.propertyText
              }
            >
              <Text
                style={
                  styles.heroTitle
                }
                numberOfLines={
                  2
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
                numberOfLines={
                  2
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
          </View>

          {checkoutPending ? (
            <Badge
              text={t(
                'pending',
                {
                  defaultValue:
                    'Pending',
                },
              )}
              tone="warning"
            />
          ) : (
            <SubmissionStatusBadge
              state={
                apartmentStatus.state
              }
              text={
                apartmentStatus.state ===
                'COMPLETE'
                  ? 'Readings sent'
                  : apartmentStatus.state ===
                      'DUE'
                    ? 'Readings due'
                    : apartmentStatus.state ===
                        'OVERDUE'
                      ? 'Overdue'
                      : 'No readings'
              }
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

      <SectionTitle
        title={t(
          'rentTerms',
          {
            defaultValue:
              'Rent & tenancy',
          },
        )}
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
              {t(
                'rent',
                {
                  defaultValue:
                    'Rent',
                },
              )}
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
              {t(
                'paymentDue',
                {
                  defaultValue:
                    'Payment due',
                },
              )}
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {t(
                'dayNumber',
                {
                  defaultValue:
                    'Day {{day}}',
                  day:
                    apartment.paymentDueDay,
                },
              )}
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
              {t(
                'startDate',
                {
                  defaultValue:
                    'Start date',
                },
              )}
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
              {t(
                'endDate',
                {
                  defaultValue:
                    'End date',
                },
              )}
            </Text>

            <Text
              style={
                styles.valueSmall
              }
            >
              {apartment.endDate
                ? formatDate(
                    apartment.endDate,
                  )
                : t(
                    'openEnded',
                    {
                      defaultValue:
                        'Open-ended',
                    },
                  )}
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
              {t(
                'securityDeposit',
                {
                  defaultValue:
                    'Security deposit',
                },
              )}
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
              {t(
                'agreement',
                {
                  defaultValue:
                    'Agreement',
                },
              )}
            </Text>

            <Text
              style={
                styles.valueSmall
              }
            >
              {apartment.agreementPath
                ? t(
                    'agreementAvailable',
                    {
                      defaultValue:
                        'Available',
                    },
                  )
                : t(
                    'notAttached',
                    {
                      defaultValue:
                        'Not attached',
                    },
                  )}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle
        title={t(
          'paymentStatus',
          {
            defaultValue:
              'Payment status',
          },
        )}
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
            {t(
              'outstanding',
              {
                defaultValue:
                  'Outstanding',
              },
            )}
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
            {t(
              'advance',
              {
                defaultValue:
                  'Advance',
              },
            )}
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
        title={t(
          'metersAndServices',
          {
            defaultValue:
              'Meters & services',
          },
        )}
      />

      {apartment.meters.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            {t(
              'noMetersOrServices',
              {
                defaultValue:
                  'No meters or services have been configured yet.',
              },
            )}
          </Text>
        </Card>
      ) : (
        apartment.meters.map(
          meter => {
            const status =
              getMeterSubmissionStatus(
                meter,
              );

            const latest =
              latestReadingText(
                meter,
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
                      'VARIABLE' &&
                    meter.lastAmount !==
                      undefined ? (
                      <Text
                        style={
                          styles.muted
                        }
                      >
                        Last amount:{' '}
                        {
                          meter.lastAmount
                        }{' '}
                        {
                          meter.billingCurrency
                        }
                      </Text>
                    ) : null}
                  </View>

                  {meter.billingMode ===
                  'METERED' ? (
                    <SubmissionStatusBadge
                      state={
                        status.state
                      }
                      text={meterStatusText(
                        meter,
                      )}
                    />
                  ) : (
                    <Badge
                      text={
                        meter.billingMode ===
                        'FIXED'
                          ? 'Fixed'
                          : 'Variable'
                      }
                      tone="neutral"
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
                      {t(
                        'lastReadings',
                        {
                          defaultValue:
                            'Last readings',
                        },
                      )}
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
              </Card>
            );
          },
        )
      )}

      {!checkoutPending &&
      metered.length >
        0 ? (
        <SecondaryButton
          title={t(
            'openReadings',
            {
              defaultValue:
                'Open readings',
            },
          )}
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

      {checkoutPending ? (
        <Card>
          <Text
            style={
              styles.title
            }
          >
            {t(
              'checkoutRequired',
              {
                defaultValue:
                  'Checkout required',
              },
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'checkoutRegularReadingsDisabled',
              {
                defaultValue:
                  'Regular monthly readings are disabled while checkout is pending.',
              },
            )}
          </Text>
        </Card>
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

    propertyIdentity: {
      flex:
        1,

      minWidth:
        0,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.sm,
    },

    propertyText: {
      flex:
        1,

      minWidth:
        0,
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
  });