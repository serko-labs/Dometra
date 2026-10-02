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
  MeterSubmissionBadge,
} from '../components/MeterSubmissionBadge';

import {
  getLocaleTag,
} from '../i18n/language';

import {
  loadTenantFinanceBalances,
  TenantFinanceBalance,
} from '../services/financeRepository';

import {
  findMeterSubmissionStatus,
  loadMeterSubmissionStatuses,
  MeterSubmissionStatus,
} from '../services/meterSubmissionStatus';

import {
  registerPushNotificationsForCurrentUser,
} from '../services/notifications';

import {
  loadTenantApartments,
  TenantApartmentPortal,
} from '../services/tenantPortalRepository';

import {
  colors,
  spacing,
} from '../theme';

import {
  CurrencyCode,
} from '../types';

function formatDate(
  value:
    string |
    undefined,

  locale:
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
    locale,

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

function formatMoney(
  amount:
    number,

  currency:
    CurrencyCode,
) {
  try {
    return new Intl.NumberFormat(
      undefined,

      {
        style:
          'currency',

        currency,

        maximumFractionDigits:
          0,
      },
    ).format(
      amount,
    );
  } catch {
    return `${Math.round(
      amount,
    ).toLocaleString()} ${currency}`;
  }
}

function latestMeterText(
  apartment:
    TenantApartmentPortal,
) {
  const values =
    apartment.meters
      .filter(
        meter =>
          meter.billingMode ===
          'METERED',
      )
      .flatMap(
        meter =>
          meter.registers
            .filter(
              register =>
                register.lastValue !==
                undefined,
            )
            .map(
              register =>
                `${meter.name}${
                  meter.registers.length >
                  1
                    ? ` ${register.code}`
                    : ''
                }: ${register.lastValue} ${register.unit}`,
            ),
      );

  return values.slice(
    0,
    3,
  );
}

export function TenantHomeScreen() {
  const navigation =
    useNavigation<any>();

  const {
    t,
    i18n,
  } =
    useTranslation();

  const locale =
    getLocaleTag(
      i18n.resolvedLanguage ??
        i18n.language,
    );

  const [
    apartments,
    setApartments,
  ] =
    useState<
      TenantApartmentPortal[]
    >([]);

  const [
    meterStatuses,
    setMeterStatuses,
  ] =
    useState<
      MeterSubmissionStatus[]
    >([]);

  const [
    financeBalances,
    setFinanceBalances,
  ] =
    useState<
      TenantFinanceBalance[]
    >([]);

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
              const apartmentData =
                await loadTenantApartments();

              const [
                statusData,
                balanceData,
              ] =
                await Promise.all([
                  loadMeterSubmissionStatuses(),

                  loadTenantFinanceBalances(
                    apartmentData.map(
                      apartment =>
                        apartment.tenancyId,
                    ),
                  ),
                ]);

              if (
                !active
              ) {
                return;
              }

              setApartments(
                apartmentData,
              );

              setMeterStatuses(
                statusData,
              );

              setFinanceBalances(
                balanceData,
              );

              if (
                apartmentData.length >
                0
              ) {
                void registerPushNotificationsForCurrentUser()
                  .catch(
                    error => {
                      console.warn(
                        '[Dometra] Push registration failed:',
                        error,
                      );
                    },
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
                    'tenantHomeTitle',
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

  const financeByTenancy =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            TenantFinanceBalance
          >();

        for (
          const balance
          of financeBalances
        ) {
          map.set(
            balance.tenancyId,
            balance,
          );
        }

        return map;
      },

      [
        financeBalances,
      ],
    );

  const totalDebt =
    useMemo(
      () => {
        const totals =
          new Map<
            CurrencyCode,
            number
          >();

        for (
          const balance
          of financeBalances
        ) {
          if (
            balance.outstanding <=
            0
          ) {
            continue;
          }

          const currency =
            balance.currency ??
            'UAH';

          totals.set(
            currency,

            (
              totals.get(
                currency,
              ) ??
              0
            ) +
              balance.outstanding,
          );
        }

        return Array.from(
          totals.entries(),
        ).map(
          ([
            currency,
            amount,
          ]) => ({
            currency,
            amount,
          }),
        );
      },

      [
        financeBalances,
      ],
    );

  const totalDebtText =
    totalDebt.length >
    0
      ? totalDebt
          .map(
            item =>
              formatMoney(
                item.amount,
                item.currency,
              ),
          )
          .join(
            ' + ',
          )
      : '0';

  return (
    <Screen>
      <Header
        title={
          t(
            'tenantHomeTitle',
          )
        }
        subtitle={
          t(
            'rentalApartments',
          )
        }
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
            )}
          </Text>
        </Card>
      ) : null}

      {!loading &&
      apartments.length >
        0 ? (
        <>
          <SectionTitle
            title={
              t(
                'outstanding',
              )
            }
          />

          <Card>
            <Text
              style={
                styles.totalDebtLabel
              }
            >
              Total debt
            </Text>

            <Text
              style={[
                styles.totalDebtValue,

                totalDebt.length >
                  0 &&
                  styles.debtText,
              ]}
            >
              {
                totalDebtText
              }
            </Text>
          </Card>
        </>
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
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'noActiveTenancyDescription',
            )}
          </Text>
        </Card>
      ) : null}

      {apartments.map(
        apartment => {
          const latest =
            latestMeterText(
              apartment,
            );

          const finance =
            financeByTenancy.get(
              apartment.tenancyId,
            );

          const debtCurrency =
            finance?.currency ??
            apartment.currency;

          const debt =
            finance?.outstanding ??
            0;

          const advance =
            finance?.advance ??
            0;

          const meteredMeters =
            apartment.meters.filter(
              meter =>
                meter.billingMode ===
                'METERED',
            );

          const submittedCount =
            meteredMeters.filter(
              meter =>
                findMeterSubmissionStatus(
                  meterStatuses,
                  meter.id,
                )?.submitted ===
                true,
            ).length;

          return (
            <React.Fragment
              key={
                apartment.tenancyId
              }
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

                  <Badge
                    text={
                      t(
                        'active',
                      )
                    }
                    tone="success"
                  />
                </View>

                <View
                  style={
                    styles.separator
                  }
                />

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
                          day:
                            apartment.paymentDueDay,
                        },
                      )}
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.financeGrid
                  }
                >
                  <View
                    style={
                      styles.financeCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {t(
                        'outstanding',
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.financeValue,

                        debt >
                          0 &&
                          styles.debtText,
                      ]}
                    >
                      {formatMoney(
                        debt,
                        debtCurrency,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.financeCell
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {t(
                        'advance',
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.financeValue,

                        advance >
                          0 &&
                          styles.advanceText,
                      ]}
                    >
                      {formatMoney(
                        advance,
                        debtCurrency,
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
                        'started',
                      )}
                    </Text>

                    <Text
                      style={
                        styles.valueSmall
                      }
                    >
                      {formatDate(
                        apartment.startDate,
                        locale,
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
                            locale,
                          )
                        : t(
                            'openEnded',
                          )}
                    </Text>
                  </View>
                </View>

                {apartment.depositAmount !==
                undefined ? (
                  <View
                    style={
                      styles.deposit
                    }
                  >
                    <Text
                      style={
                        styles.label
                      }
                    >
                      {t(
                        'securityDeposit',
                      )}
                    </Text>

                    <Text
                      style={
                        styles.valueSmall
                      }
                    >
                      {
                        apartment.depositAmount
                      }{' '}
                      {apartment.depositCurrency ??
                        apartment.currency}
                    </Text>
                  </View>
                ) : null}
              </Card>

              <View
                style={
                  styles.sectionHeader
                }
              >
                <SectionTitle
                  title={
                    t(
                      'metersAndServices',
                    )
                  }
                />

                {meteredMeters.length >
                0 ? (
                  <Text
                    style={
                      styles.sectionProgress
                    }
                  >
                    {t(
                      'submittedProgress',

                      {
                        submitted:
                          submittedCount,

                        total:
                          meteredMeters.length,
                      },
                    )}
                  </Text>
                ) : null}
              </View>

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
                    )}
                  </Text>
                </Card>
              ) : (
                <Card>
                  {apartment.meters.map(
                    (
                      meter,
                      index,
                    ) => {
                      const meterStatus =
                        meter.billingMode ===
                        'METERED'
                          ? findMeterSubmissionStatus(
                              meterStatuses,
                              meter.id,
                            )
                          : undefined;

                      return (
                        <View
                          key={
                            meter.id
                          }
                        >
                          {index >
                          0 ? (
                            <View
                              style={
                                styles.smallSeparator
                              }
                            />
                          ) : null}

                          <View
                            style={
                              styles.meterRow
                            }
                          >
                            <View
                              style={
                                styles.flex
                              }
                            >
                              <View
                                style={
                                  styles.meterTitleRow
                                }
                              >
                                <Text
                                  style={
                                    styles.meterName
                                  }
                                >
                                  {
                                    meter.name
                                  }
                                </Text>

                                {meter.billingMode ===
                                'METERED' ? (
                                  <MeterSubmissionBadge
                                    status={
                                      meterStatus
                                    }
                                  />
                                ) : null}
                              </View>

                              {meter.billingMode ===
                                'METERED' &&
                              meterStatus &&
                              !meterStatus.submitted ? (
                                <Text
                                  style={
                                    styles.dueText
                                  }
                                >
                                  {t(
                                    'sendBeforeFifth',
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
                                  {t(
                                    'perMonth',
                                  )}
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
                                  {t(
                                    'lastValue',

                                    {
                                      value:
                                        meter.lastAmount,

                                      currency:
                                        meter.billingCurrency,
                                    },
                                  )}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      );
                    },
                  )}
                </Card>
              )}

              {latest.length >
              0 ? (
                <>
                  <SectionTitle
                    title={
                      t(
                        'lastReadings',
                      )
                    }
                  />

                  <Card>
                    {latest.map(
                      (
                        text,
                        index,
                      ) => (
                        <Text
                          key={`${text}-${index}`}
                          style={
                            styles.lastReading
                          }
                        >
                          {text}
                        </Text>
                      ),
                    )}
                  </Card>
                </>
              ) : null}

              <SecondaryButton
                title={
                  t(
                    'openReadings',
                  )
                }
                onPress={() =>
                  navigation.navigate(
                    'Readings',
                  )
                }
              />
            </React.Fragment>
          );
        },
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
        20,

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

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    smallSeparator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
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

    financeGrid: {
      flexDirection:
        'row',

      gap:
        spacing.md,

      paddingVertical:
        spacing.md,

      marginBottom:
        spacing.md,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    financeCell: {
      flex:
        1,
    },

    financeValue: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '800',

      marginTop:
        5,
    },

    debtText: {
      color:
        '#B42318',
    },

    advanceText: {
      color:
        '#067647',
    },

    totalDebtLabel: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    totalDebtValue: {
      color:
        colors.text,

      fontSize:
        28,

      fontWeight:
        '800',

      marginTop:
        6,
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

    deposit: {
      marginTop:
        2,
    },

    sectionHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    sectionProgress: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    meterRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    meterTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        8,
    },

    meterName: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    dueText: {
      color:
        '#B42318',

      fontSize:
        11,

      fontWeight:
        '700',

      marginTop:
        5,
    },

    lastReading: {
      color:
        colors.text,

      fontSize:
        13,

      lineHeight:
        22,

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

      marginTop:
        4,
    },

    emptyTitle: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },
  });