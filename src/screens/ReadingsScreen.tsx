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
  findMeterSubmissionStatus,
  loadMeterSubmissionStatuses,
  MeterSubmissionStatus,
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
  value: string | undefined,
  locale: string,
) {
  if (!value) {
    return '';
  }

  const normalized =
    value.includes('T')
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

function lastReadingText(
  meter:
    Meter,
) {
  const values =
    meter.registers
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
      );

  return values.join(
    ' • ',
  );
}

function lastReadingDate(
  meter:
    Meter,
) {
  const dates =
    meter.registers
      .map(
        register =>
          register.lastReadingAt,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      );

  if (
    dates.length ===
    0
  ) {
    return undefined;
  }

  return dates
    .sort()
    .reverse()[0];
}

export function ReadingsScreen() {
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
              const [
                apartmentData,
                statusData,
              ] =
                await Promise.all([
                  loadTenantApartments(),

                  loadMeterSubmissionStatuses(),
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
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  t(
                    'readings',
                  ),

                  error instanceof
                  Error
                    ? error.message
                    : t(
                        'loadingMeters',
                      ),
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

  const openReading =
    (
      meterId:
        string,
    ) => {
      navigation
        .getParent()
        ?.navigate(
          'MeterReading',

          {
            meterId,

            source:
              'TENANT',
          },
        );
    };

  return (
    <Screen>
      <Header
        title={
          t(
            'readings',
          )
        }
        subtitle={
          t(
            'readingsSubtitle',
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
              'loadingMeters',
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
              styles.title
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
              'readingsAvailableAfterJoin',
            )}
          </Text>
        </Card>
      ) : null}

      {apartments.map(
        apartment => {
          const meters =
            apartment.meters.filter(
              meter =>
                meter.billingMode ===
                'METERED',
            );

          const checkoutPending =
            apartment.status ===
            'CHECKOUT_PENDING';

          const submittedCount =
            meters.filter(
              meter =>
                findMeterSubmissionStatus(
                  meterStatuses,
                  meter.id,
                )?.submitted ===
                true,
            ).length;

          return (
            <View
              key={
                apartment.tenancyId
              }
            >
              <View
                style={
                  styles.apartmentTitleRow
                }
              >
                <SectionTitle
                  title={
                    apartment.propertyName
                  }
                />

                {!checkoutPending &&
                meters.length >
                  0 ? (
                  <Text
                    style={
                      styles.progress
                    }
                  >
                    {t(
                      'submittedProgress',

                      {
                        submitted:
                          submittedCount,

                        total:
                          meters.length,
                      },
                    )}
                  </Text>
                ) : null}
              </View>

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

              {checkoutPending ? (
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
                        {t(
                          'checkoutRequired',
                        )}
                      </Text>

                      <Text
                        style={
                          styles.muted
                        }
                      >
                        {t(
                          'checkoutRegularReadingsDisabled',
                        )}
                      </Text>
                    </View>

                    <Badge
                      text={
                        t(
                          'pending',
                        )
                      }
                      tone="warning"
                    />
                  </View>
                </Card>
              ) : null}

              {meters.length ===
              0 ? (
                <Card>
                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {t(
                      'noUtilityMeters',
                    )}
                  </Text>
                </Card>
              ) : null}

              {meters.map(
                meter => {
                  const last =
                    lastReadingText(
                      meter,
                    );

                  const date =
                    lastReadingDate(
                      meter,
                    );

                  const status =
                    findMeterSubmissionStatus(
                      meterStatuses,
                      meter.id,
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

                          <Text
                            style={
                              styles.tariff
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
                        </View>

                        {!checkoutPending ? (
                          <MeterSubmissionBadge
                            status={
                              status
                            }
                          />
                        ) : null}
                      </View>

                      {!checkoutPending &&
                      status &&
                      !status.submitted ? (
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

                      <View
                        style={
                          styles.separator
                        }
                      />

                      {last ? (
                        <>
                          <Text
                            style={
                              styles.label
                            }
                          >
                            {t(
                              'previousValue',
                            )}
                          </Text>

                          <Text
                            style={
                              styles.lastValue
                            }
                          >
                            {last}
                          </Text>

                          {date ? (
                            <Text
                              style={
                                styles.muted
                              }
                            >
                              {t(
                                'lastSubmitted',

                                {
                                  date:
                                    formatDate(
                                      date,
                                      locale,
                                    ),
                                },
                              )}
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          {t(
                            'noReadingsYet',
                          )}
                        </Text>
                      )}

                      {!checkoutPending ? (
                        <View
                          style={
                            styles.buttonTop
                          }
                        >
                          <SecondaryButton
                            title={
                              status?.submitted
                                ? t(
                                    'updateReading',
                                  )
                                : t(
                                    'addReading',
                                  )
                            }
                            onPress={() =>
                              openReading(
                                meter.id,
                              )
                            }
                          />
                        </View>
                      ) : null}
                    </Card>
                  );
                },
              )}
            </View>
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

    apartmentTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    progress: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    rowBetween: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
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
        12,

      marginBottom:
        spacing.sm,

      marginTop:
        -4,
    },

    tariff: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    dueText: {
      color:
        '#B42318',

      fontSize:
        11,

      fontWeight:
        '700',

      marginTop:
        8,
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

    lastValue: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',

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

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },
  });