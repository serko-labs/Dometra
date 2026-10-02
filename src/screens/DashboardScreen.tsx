import React, {
  useCallback,
  useMemo,
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
  getPropertyTenancy,
  PropertyTenancySummary,
} from '../services/tenantRepository';

import {
  CurrencyCode,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function moneyText(
  amount: number,
  currency: CurrencyCode,
) {
  return `${Math.round(
    amount,
  ).toLocaleString()} ${currency}`;
}

function tenancyName(
  tenancy?:
    PropertyTenancySummary | null,
) {
  if (!tenancy) {
    return 'Available';
  }

  if (
    tenancy.status ===
    'PENDING'
  ) {
    return 'Invitation pending';
  }

  if (tenancy.tenant) {
    const value =
      `${tenancy.tenant.firstName} ${tenancy.tenant.lastName}`.trim();

    if (value) {
      return value;
    }
  }

  return tenancy.status ===
    'CHECKOUT_PENDING'
    ? 'Checkout required'
    : 'Occupied';
}

export function DashboardScreen() {
  const navigation =
    useNavigation<any>();

  const {
    state,
    setMode,
  } =
    useApp();

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

  const [
    finance,
    setFinance,
  ] =
    useState<
      LandlordFinanceOverview | null
    >(null);

  const [
    tenancies,
    setTenancies,
  ] =
    useState<
      Record<
        string,
        PropertyTenancySummary | null
      >
    >({});

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
            const workspaceId =
              state.workspace?.id;

            if (!workspaceId) {
              if (active) {
                setFinance(
                  null,
                );

                setTenancies(
                  {},
                );

                setLoading(
                  false,
                );
              }

              return;
            }

            setLoading(
              true,
            );

            try {
              const workspace =
                state.workspace as any;

              const baseCurrency =
                (
                  workspace?.baseCurrency ??
                  state.settings.displayCurrency ??
                  'UAH'
                ) as CurrencyCode;

              const [
                financeData,
                tenancyRows,
              ] =
                await Promise.all([
                  loadLandlordFinanceOverview(
                    workspaceId,
                    activeProperties.map(
                      property =>
                        property.id,
                    ),
                    baseCurrency,
                    state.settings.timezone,
                  ),

                  Promise.all(
                    activeProperties.map(
                      async property => ({
                        propertyId:
                          property.id,

                        tenancy:
                          await getPropertyTenancy(
                            property.id,
                          ),
                      }),
                    ),
                  ),
                ]);

              if (!active) {
                return;
              }

              setFinance(
                financeData,
              );

              setTenancies(
                Object.fromEntries(
                  tenancyRows.map(
                    row => [
                      row.propertyId,
                      row.tenancy,
                    ],
                  ),
                ),
              );
            } catch (error) {
              if (active) {
                Alert.alert(
                  'Dashboard',
                  error instanceof Error
                    ? error.message
                    : 'Unable to load financial overview.',
                );
              }
            } finally {
              if (active) {
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
        state.workspace?.id,
        state.settings.displayCurrency,
        state.settings.timezone,
        state.properties,
      ],
    ),
  );

  const currency =
    finance?.currency ??
    state.settings.displayCurrency;

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

  const rate =
    finance?.collectionRate ??
    0;

  return (
    <Screen>
      <Header
        title="Dometra"
        subtitle={`${activeProperties.length} / 4 active properties`}
        right={
          <TextButton
            title="Tenant"
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
          label="Expected this month"
          value={
            moneyText(
              expected,
              currency,
            )
          }
          hint="Issued invoices"
        />

        <StatCard
          label="Received this month"
          value={
            moneyText(
              received,
              currency,
            )
          }
          hint={`${rate.toFixed(
            0,
          )}% collection rate`}
        />

        <StatCard
          label="Outstanding debt"
          value={
            moneyText(
              outstanding,
              currency,
            )
          }
          hint={
            finance
              ? `${finance.debtTenancies} tenant${
                  finance.debtTenancies === 1
                    ? ''
                    : 's'
                } with debt`
              : undefined
          }
        />

        <StatCard
          label="Advance"
          value={
            moneyText(
              advance,
              currency,
            )
          }
          hint="Unallocated tenant credit"
        />
      </View>

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading financial overview...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      finance &&
      !finance.financeAvailable ? (
        <Card>
          <Text
            style={
              styles.cardTitle
            }
          >
            Finance module is not ready
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Apply the finance migration before invoices,
            payments and debt can be displayed.
          </Text>
        </Card>
      ) : null}

      <SectionTitle
        title="Monthly rent forecast"
      />

      {finance &&
      finance.forecastByCurrency.length >
        0 ? (
        <Card>
          {finance.forecastByCurrency.map(
            forecast => (
              <View
                key={
                  forecast.currency
                }
                style={
                  styles.forecastRow
                }
              >
                <Text
                  style={
                    styles.forecastLabel
                  }
                >
                  {forecast.currency}
                </Text>

                <Text
                  style={
                    styles.forecastValue
                  }
                >
                  {forecast.amount.toLocaleString()}{' '}
                  {forecast.currency}
                </Text>
              </View>
            ),
          )}
        </Card>
      ) : (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No active rent forecast yet.
          </Text>
        </Card>
      )}

      <SectionTitle
        title="Reminders"
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
                      {reminder.title}
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      {property?.name}
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

      <SectionTitle
        title="Active properties"
        action={
          <TextButton
            title="+ Add apartment"
            onPress={() =>
              navigation.navigate(
                'AddProperty',
              )
            }
          />
        }
      />

      {activeProperties
        .slice(
          0,
          4,
        )
        .map(
          property => {
            const tenancy =
              tenancies[
                property.id
              ];

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
                        {property.name}
                      </Text>

                      <Text
                        style={
                          styles.muted
                        }
                      >
                        {tenancyName(
                          tenancy,
                        )}
                      </Text>
                    </View>

                    <Badge
                      text={
                        !tenancy
                          ? 'Available'
                          : tenancy.status ===
                              'PENDING'
                            ? 'Pending'
                            : tenancy.status ===
                                'CHECKOUT_PENDING'
                              ? 'Checkout'
                              : 'Occupied'
                      }
                      tone={
                        !tenancy
                          ? 'neutral'
                          : tenancy.status ===
                              'ACTIVE'
                            ? 'success'
                            : 'warning'
                      }
                    />
                  </View>

                  {tenancy &&
                  tenancy.status !==
                    'PENDING' ? (
                    <Text
                      style={
                        styles.rentText
                      }
                    >
                      Rent:{' '}
                      {tenancy.rentAmount.toLocaleString()}{' '}
                      {tenancy.currency} / month
                    </Text>
                  ) : null}
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
      marginTop:
        4,
      lineHeight:
        18,
    },

    rentText: {
      color:
        colors.muted,
      fontSize:
        12,
      marginTop:
        spacing.sm,
      fontWeight:
        '600',
    },

    forecastRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingVertical:
        5,
    },

    forecastLabel: {
      color:
        colors.muted,
      fontSize:
        12,
      fontWeight:
        '700',
    },

    forecastValue: {
      color:
        colors.text,
      fontSize:
        15,
      fontWeight:
        '800',
    },
  });