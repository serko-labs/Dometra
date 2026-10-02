import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
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
  SectionTitle,
  StatCard,
  TextButton,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  LandlordFinanceOverview,
  loadLandlordFinanceOverview,
} from '../services/financeRepository';

import {
  colors,
  spacing,
} from '../theme';

import {
  CurrencyCode,
} from '../types';

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

export function DashboardScreen() {
  const {
    t,
  } =
    useTranslation();

  const navigation =
    useNavigation<any>();

  const {
    state,
    setMode,
  } =
    useApp();

  const [
    finance,
    setFinance,
  ] =
    useState<
      LandlordFinanceOverview | null
    >(
      null,
    );

  const [
    financeLoading,
    setFinanceLoading,
  ] =
    useState(
      true,
    );

  const [
    financeError,
    setFinanceError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const activeProperties =
    useMemo(
      () =>
        state.properties.filter(
          property =>
            property.status ===
            'ACTIVE',
        ),

      [
        state.properties,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        let active =
          true;

        const load =
          async () => {
            if (
              !state.workspace
            ) {
              if (
                active
              ) {
                setFinance(
                  null,
                );

                setFinanceLoading(
                  false,
                );
              }

              return;
            }

            setFinanceLoading(
              true,
            );

            setFinanceError(
              null,
            );

            try {
              const result =
                await loadLandlordFinanceOverview(
                  state.workspace.id,

                  activeProperties.map(
                    property =>
                      property.id,
                  ),

                  state.workspace.baseCurrency,

                  state.workspace.timezone,
                );

              if (
                active
              ) {
                setFinance(
                  result,
                );
              }
            } catch (
              error
            ) {
              if (
                active
              ) {
                setFinanceError(
                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load finance overview.',
                );
              }
            } finally {
              if (
                active
              ) {
                setFinanceLoading(
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
        state.workspace?.id,
        state.workspace?.baseCurrency,
        state.workspace?.timezone,
        activeProperties,
      ],
    ),
  );

  const currency =
    finance?.currency ??
    state.workspace
      ?.baseCurrency ??
    'UAH';

  const expected =
    finance?.expectedThisMonth ??
    0;

  const received =
    finance?.receivedThisMonth ??
    0;

  const outstanding =
    finance?.outstanding ??
    0;

  const advance =
    finance?.advance ??
    0;

  const collectionRate =
    finance?.collectionRate ??
    0;

  const forecast =
    finance
      ?.forecastByCurrency
      .map(
        item =>
          formatMoney(
            item.amount,
            item.currency,
          ),
      )
      .join(
        ' + ',
      ) ||
    '—';

  return (
    <Screen>
      <Header
        title="Dometra"
        subtitle={`${activeProperties.length} / 4 ${t(
          'activeProperties',
        ).toLowerCase()}`}
        right={
          <TextButton
            title={
              t(
                'tenant',
              )
            }
            onPress={() =>
              void setMode(
                'TENANT',
              )
            }
          />
        }
      />

      <View
        style={
          styles.stats
        }
      >
        <StatCard
          label={
            t(
              'expected',
            )
          }
          value={
            financeLoading
              ? '…'
              : formatMoney(
                  expected,
                  currency,
                )
          }
        />

        <StatCard
          label={
            t(
              'received',
            )
          }
          value={
            financeLoading
              ? '…'
              : formatMoney(
                  received,
                  currency,
                )
          }
          hint={
            financeLoading
              ? undefined
              : `${collectionRate.toFixed(
                  0,
                )}% ${t(
                  'collectionRate',
                ).toLowerCase()}`
          }
        />

        <StatCard
          label={
            t(
              'outstanding',
            )
          }
          value={
            financeLoading
              ? '…'
              : formatMoney(
                  outstanding,
                  currency,
                )
          }
          hint={
            !financeLoading &&
            (
              finance?.debtTenancies ??
              0
            ) >
              0
              ? `${finance?.debtTenancies} tenant${
                  finance?.debtTenancies ===
                  1
                    ? ''
                    : 's'
                }`
              : undefined
          }
        />

        <StatCard
          label={
            t(
              'advance',
            )
          }
          value={
            financeLoading
              ? '…'
              : formatMoney(
                  advance,
                  currency,
                )
          }
        />
      </View>

      <SectionTitle
        title="Rent forecast"
      />

      <Card>
        <Text
          style={
            styles.forecastValue
          }
        >
          {financeLoading
            ? '…'
            : forecast}
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          Monthly recurring rent from active rental agreements.
        </Text>
      </Card>

      {financeError ? (
        <Card>
          <Text
            style={
              styles.errorTitle
            }
          >
            Finance data
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {
              financeError
            }
          </Text>
        </Card>
      ) : null}

      {!financeLoading &&
      finance &&
      !finance.financeAvailable ? (
        <Card>
          <Text
            style={
              styles.warningTitle
            }
          >
            Finance module is not fully connected yet
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Rent forecast is already calculated from active rental agreements.
            Received, debt and advance will start filling from Supabase invoices
            and payments.
          </Text>
        </Card>
      ) : null}

      {state.reminders.some(
        reminder =>
          !reminder.completed,
      ) ? (
        <>
          <SectionTitle
            title={
              t(
                'reminders',
              )
            }
          />

          {state.reminders
            .filter(
              reminder =>
                !reminder.completed,
            )
            .map(
              reminder => {
                const property =
                  state.properties.find(
                    item =>
                      item.id ===
                      reminder.propertyId,
                  );

                return (
                  <Card
                    key={
                      reminder.id
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
                            styles.cardTitle
                          }
                        >
                          {
                            reminder.title
                          }
                        </Text>

                        <Text
                          style={
                            styles.muted
                          }
                        >
                          {
                            property?.name
                          }
                        </Text>
                      </View>

                      <Badge
                        text={
                          reminder.dueText
                        }
                        tone="warning"
                      />
                    </View>
                  </Card>
                );
              },
            )}
        </>
      ) : null}

      <SectionTitle
        title={
          t(
            'activeProperties',
          )
        }
        action={
          <TextButton
            title={`+ ${t(
              'addProperty',
            )}`}
            onPress={() =>
              navigation.navigate(
                'AddProperty',
              )
            }
          />
        }
      />

      {activeProperties.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No active apartments yet.
          </Text>
        </Card>
      ) : null}

      {activeProperties
        .slice(
          0,
          4,
        )
        .map(
          property => {
            const meterCount =
              state.meters.filter(
                meter =>
                  meter.propertyId ===
                  property.id,
              ).length;

            return (
              <Pressable
                key={
                  property.id
                }
                onPress={() =>
                  navigation.navigate(
                    'PropertyDetails',

                    {
                      propertyId:
                        property.id,
                    },
                  )
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
                          styles.cardTitle
                        }
                      >
                        {
                          property.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.muted
                        }
                      >
                        {
                          property.address
                        }
                        ,{' '}
                        {
                          property.city
                        }
                      </Text>
                    </View>

                    <Badge
                      text={`${meterCount} ${
                        meterCount ===
                        1
                          ? 'meter'
                          : 'meters'
                      }`}
                      tone="neutral"
                    />
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
    stats: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        spacing.sm,

      justifyContent:
        'space-between',
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

    flex: {
      flex:
        1,
    },

    cardTitle: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '700',
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        13,

      lineHeight:
        19,

      marginTop:
        4,
    },

    forecastValue: {
      color:
        colors.text,

      fontSize:
        24,

      fontWeight:
        '800',
    },

    errorTitle: {
      color:
        colors.danger ??
        '#B42318',

      fontSize:
        14,

      fontWeight:
        '800',
    },

    errorText: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        5,
    },

    warningTitle: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },
  });