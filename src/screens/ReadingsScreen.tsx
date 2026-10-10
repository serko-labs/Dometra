import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useNavigation,
} from '@react-navigation/native';

import {
  useQuery,
} from '@tanstack/react-query';

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
  queryKeys,
} from '../lib/queryClient';

import {
  loadTenantReadingsQuery,
  MeterSubmissionStatuses,
} from '../queries/tenantQueries';

import {
  Meter,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';


type MeterSubmissionStatus =
  MeterSubmissionStatuses[number];


function formatDate(
  value:
    string | undefined,

  locale:
    string,
) {
  if (
    !value
  ) {
    return '';
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


/*
 * meterSubmissionStatus.ts does not currently export its old
 * helper function.
 *
 * Keep lookup logic here and support both camelCase and raw
 * Supabase snake_case identifiers.
 */
function findMeterStatus(
  statuses:
    MeterSubmissionStatuses,

  meterId:
    string,
):
  | MeterSubmissionStatus
  | undefined {
  return statuses.find(
    status => {
      const candidate =
        status as MeterSubmissionStatus & {
          meterId?:
            string;

          meter_id?:
            string;
        };

      return (
        candidate.meterId ===
          meterId ||
        candidate.meter_id ===
          meterId
      );
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

  return 'Unable to load meters.';
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


  const {
    data,
    error,
    isPending,
    isFetching,
    refetch,
  } =
    useQuery({
      queryKey:
        queryKeys.tenantReadings,

      queryFn:
        () =>
          loadTenantReadingsQuery(),
    });


  const apartments =
    data?.apartments ??
    [];

  const meterStatuses =
    data?.meterStatuses ??
    [];

  const checkouts =
    data?.checkouts ??
    {};


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


  const refresh =
    () => {
      if (
        isFetching
      ) {
        return;
      }

      void refetch();
    };


  return (
    <Screen>
      <Header
        title={t(
          'readings',
        )}
        subtitle={t(
          'readingsSubtitle',
        )}
      />


      {!isPending ? (
        <View
          style={
            styles.refreshWrap
          }
        >
          <SecondaryButton
            title={
              isFetching
                ? 'Refreshing...'
                : 'Refresh'
            }
            onPress={
              refresh
            }
          />
        </View>
      ) : null}


      {isPending ? (
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


      {!isPending &&
      error ? (
        <Card>
          <Text
            style={
              styles.title
            }
          >
            Unable to load readings
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {errorMessage(
              error,
            )}
          </Text>
        </Card>
      ) : null}


      {!isPending &&
      !error &&
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


          /*
           * Checkout status is independent from tenancy status.
           *
           * Tenancy remains ACTIVE until landlord completion.
           */
          const checkoutPending =
            checkouts[
              apartment.tenancyId
            ]?.status ===
            'PENDING';


          const submittedCount =
            meters.filter(
              meter =>
                findMeterStatus(
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
                      text={t(
                        'pending',
                      )}
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
                    findMeterStatus(
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

    refreshWrap: {
      marginBottom:
        spacing.sm,
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