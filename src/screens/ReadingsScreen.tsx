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
} from '../components/ui';

import {
  SubmissionStatusBadge,
} from '../components/SubmissionStatusBadge';

import {
  getLocaleTag,
} from '../i18n/language';

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

function statusText(
  state:
    ReturnType<
      typeof getMeterSubmissionStatus
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
      1
      ? `${submitted}/${total} submitted`
      : 'Submitted';
  }

  if (
    state ===
    'DUE'
  ) {
    return 'Due';
  }

  if (
    state ===
    'OVERDUE'
  ) {
    return 'Overdue';
  }

  return 'Not required';
}

export function ReadingsScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

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
              const apartmentData =
                await loadTenantApartments();

              const selected =
                apartmentData.find(
                  item =>
                    item.tenancyId ===
                    tenancyId,
                ) ??
                (
                  tenancyId
                    ? null
                    : apartmentData[0] ??
                      null
                );

              if (
                active
              ) {
                setApartment(
                  selected,
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
                    'readings',
                    {
                      defaultValue:
                        'Readings',
                    },
                  ),

                  error instanceof
                  Error
                    ? error.message
                    : t(
                        'loadingMeters',
                        {
                          defaultValue:
                            'Unable to load meters.',
                        },
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
        tenancyId,
        t,
      ],
    ),
  );

  const openReading =
    (
      meterId:
        string,
    ) => {
      navigation.navigate(
        'MeterReading',

        {
          meterId,

          source:
            'TENANT',
        },
      );
    };

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title={t(
            'readings',
            {
              defaultValue:
                'Readings',
            },
          )}
          subtitle={t(
            'readingsSubtitle',
            {
              defaultValue:
                'Submit current meter values',
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
              'loadingMeters',
              {
                defaultValue:
                  'Loading meters...',
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
            'readings',
            {
              defaultValue:
                'Readings',
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
              'readingsAvailableAfterJoin',
              {
                defaultValue:
                  'Readings will be available after you join an apartment.',
              },
            )}
          </Text>
        </Card>
      </Screen>
    );
  }

  const meters =
    apartment.meters.filter(
      meter =>
        meter.billingMode ===
        'METERED',
    );

  const checkoutPending =
    apartment.status ===
    'CHECKOUT_PENDING';

  const apartmentStatus =
    getApartmentSubmissionStatus(
      apartment.meters,
    );

  return (
    <Screen>
      <Header
        title={t(
          'readings',
          {
            defaultValue:
              'Readings',
          },
        )}
        subtitle={
          apartment.propertyName
        }
      />

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
                styles.apartmentTitle
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

          {!checkoutPending &&
          apartmentStatus.totalMeters >
            0 ? (
            <SubmissionStatusBadge
              state={
                apartmentStatus.state
              }
              text={`${apartmentStatus.submittedMeters}/${apartmentStatus.totalMeters} submitted`}
            />
          ) : null}
        </View>
      </Card>

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
            </View>

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
              {
                defaultValue:
                  'No utility meters are configured for this apartment.',
              },
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
            getMeterSubmissionStatus(
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
                  <SubmissionStatusBadge
                    state={
                      status.state
                    }
                    text={statusText(
                      status.state,
                      status.submittedRegisters,
                      status.totalRegisters,
                    )}
                  />
                ) : null}
              </View>

              {!checkoutPending &&
              status.state ===
                'DUE' ? (
                <Text
                  style={
                    styles.dueText
                  }
                >
                  {t(
                    'sendBeforeFifth',
                    {
                      defaultValue:
                        'Send readings by the 5th.',
                    },
                  )}
                </Text>
              ) : null}

              {!checkoutPending &&
              status.state ===
                'OVERDUE' ? (
                <Text
                  style={
                    styles.overdueText
                  }
                >
                  {t(
                    'readingsOverdue',
                    {
                      defaultValue:
                        'Reading is overdue.',
                    },
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
                      {
                        defaultValue:
                          'Previous value',
                      },
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
                          defaultValue:
                            'Last submitted: {{date}}',

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
                    {
                      defaultValue:
                        'No readings yet.',
                    },
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
                      status.state ===
                      'COMPLETE'
                        ? t(
                            'updateReading',
                            {
                              defaultValue:
                                'Update reading',
                            },
                          )
                        : t(
                            'addReading',
                            {
                              defaultValue:
                                'Add reading',
                            },
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

    apartmentTitle: {
      color:
        colors.text,

      fontSize:
        18,

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
        12,

      lineHeight:
        18,

      marginTop:
        4,
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
        '#92400E',

      fontSize:
        11,

      fontWeight:
        '700',

      marginTop:
        8,
    },

    overdueText: {
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