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
  Money,
  Screen,
  SectionTitle,
  StatCard,
  TextButton,
} from '../components/ui';

import {
  SwipeActions,
} from '../components/SwipeActions';

import {
  useApp,
} from '../context/AppContext';

import {
  loadPropertyOccupancy,
  PropertyOccupancySummary,
} from '../services/propertyOccupancyRepository';

import {
  colors,
  spacing,
} from '../theme';

function toBase(
  amount: number,
  currency: string,
) {
  if (
    currency === 'USD'
  ) {
    return amount *
      42;
  }

  if (
    currency === 'EUR'
  ) {
    return amount *
      49;
  }

  return amount;
}

function badgeText(
  occupancy:
    PropertyOccupancySummary | undefined,
) {
  if (
    occupancy?.state ===
    'OCCUPIED'
  ) {
    return 'Occupied';
  }

  if (
    occupancy?.state ===
    'PENDING'
  ) {
    return 'Invitation pending';
  }

  return 'Available';
}

function badgeTone(
  occupancy:
    PropertyOccupancySummary | undefined,
) {
  if (
    occupancy?.state ===
    'OCCUPIED'
  ) {
    return 'success' as const;
  }

  if (
    occupancy?.state ===
    'PENDING'
  ) {
    return 'warning' as const;
  }

  return 'neutral' as const;
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
    removeProperty,
  } =
    useApp();

  const [
    occupancy,
    setOccupancy,
  ] =
    useState<
      Record<
        string,
        PropertyOccupancySummary
      >
    >({});

  const active =
    state.properties.filter(
      (
        property,
      ) =>
        property.status ===
        'ACTIVE',
    );

  /*
   * Reload directly from Supabase whenever the
   * Dashboard becomes visible.
   *
   * This means:
   *
   * Apartment
   * → Add tenant
   * → Save
   * → Back
   * → Dashboard
   *
   * immediately shows Occupied.
   */
  useFocusEffect(
    useCallback(
      () => {
        let activeRequest =
          true;

        const load =
          async () => {
            try {
              const data =
                await loadPropertyOccupancy(
                  active.map(
                    (
                      property,
                    ) =>
                      property.id,
                  ),
                );

              if (
                activeRequest
              ) {
                setOccupancy(
                  data,
                );
              }
            } catch (
              error
            ) {
              console.error(
                '[Dometra] Unable to load property occupancy:',
                error,
              );
            }
          };

        void load();

        return () => {
          activeRequest =
            false;
        };
      },
      [
        state.properties,
      ],
    ),
  );

  const issued =
    state.invoices.filter(
      (
        invoice,
      ) =>
        invoice.status !==
        'PAID',
    );

  const expected =
    issued.reduce(
      (
        sum,
        invoice,
      ) =>
        sum +
        invoice.lines.reduce(
          (
            lineSum,
            line,
          ) =>
            lineSum +
            toBase(
              line.amount,
              line.currency,
            ),
          0,
        ),
      0,
    );

  const received =
    state.payments.reduce(
      (
        sum,
        payment,
      ) =>
        sum +
        toBase(
          payment.amount,
          payment.currency,
        ),
      0,
    );

  const outstanding =
    Math.max(
      0,
      expected -
        received,
    );

  const advance =
    Math.max(
      0,
      received -
        expected,
    );

  const rate =
    expected >
    0
      ? Math.min(
          100,
          (
            received /
            expected
          ) *
            100,
        )
      : 0;

  const confirmRemove =
    (
      propertyId:
        string,

      propertyName:
        string,
    ) => {
      Alert.alert(
        'Remove apartment?',
        `Are you sure you want to remove "${propertyName}"?`,
        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Remove',

            style:
              'destructive',

            onPress:
              () => {
                void removeProperty(
                  propertyId,
                );
              },
          },
        ],
      );
    };

  return (
    <Screen>
      <Header
        title="Dometra"
        subtitle={`${active.length} / 4 ${t(
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
          value={`₴${Math.round(
            expected,
          ).toLocaleString(
            'uk-UA',
          )}`}
        />

        <StatCard
          label={
            t(
              'received',
            )
          }
          value={`₴${Math.round(
            received,
          ).toLocaleString(
            'uk-UA',
          )}`}
          hint={
            expected >
            0
              ? `${rate.toFixed(
                  0,
                )}% ${t(
                  'collectionRate',
                ).toLowerCase()}`
              : '—'
          }
        />

        <StatCard
          label={
            t(
              'outstanding',
            )
          }
          value={`₴${Math.round(
            outstanding,
          ).toLocaleString(
            'uk-UA',
          )}`}
        />

        <StatCard
          label={
            t(
              'advance',
            )
          }
          value={`₴${Math.round(
            advance,
          ).toLocaleString(
            'uk-UA',
          )}`}
        />
      </View>

      <SectionTitle
        title={
          t(
            'reminders',
          )
        }
      />

      {state.reminders
        .filter(
          (
            reminder,
          ) =>
            !reminder.completed,
        )
        .map(
          (
            reminder,
          ) => {
            const property =
              state.properties.find(
                (
                  item,
                ) =>
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

      {active
        .slice(
          0,
          3,
        )
        .map(
          (
            property,
          ) => {
            const currentOccupancy =
              occupancy[
                property.id
              ];

            const rentAmount =
              currentOccupancy
                ?.rentAmount ??
              property.rentAmount;

            const rentCurrency =
              currentOccupancy
                ?.rentCurrency ??
              property.rentCurrency;

            return (
              <SwipeActions
                key={
                  property.id
                }
                onEdit={() =>
                  navigation.navigate(
                    'AddProperty',
                    {
                      propertyId:
                        property.id,
                    },
                  )
                }
                onRemove={() =>
                  confirmRemove(
                    property.id,
                    property.name,
                  )
                }
              >
                <Pressable
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
                        <View
                          style={
                            styles.propertyTitleRow
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

                          <Badge
                            text={
                              badgeText(
                                currentOccupancy,
                              )
                            }
                            tone={
                              badgeTone(
                                currentOccupancy,
                              )
                            }
                          />
                        </View>

                        <Text
                          style={
                            styles.muted
                          }
                        >
                          {
                            property.address
                          },{' '}
                          {
                            property.city
                          }
                        </Text>

                        {currentOccupancy
                          ?.state ===
                          'OCCUPIED' &&
                        currentOccupancy
                          .tenantName ? (
                          <Text
                            style={
                              styles.tenantName
                            }
                          >
                            {
                              currentOccupancy.tenantName
                            }
                          </Text>
                        ) : null}

                        {currentOccupancy
                          ?.state ===
                        'PENDING' ? (
                          <Text
                            style={
                              styles.pendingText
                            }
                          >
                            Waiting for tenant to accept invitation
                          </Text>
                        ) : null}

                        {property.areaM2 >
                        0 ? (
                          <Text
                            style={
                              styles.area
                            }
                          >
                            {
                              property.areaM2
                            }{' '}
                            m²
                          </Text>
                        ) : null}
                      </View>

                      {rentAmount >
                      0 ? (
                        <Money
                          amount={
                            rentAmount
                          }
                          currency={
                            rentCurrency
                          }
                          strong
                        />
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              </SwipeActions>
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

    propertyTitleRow: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      alignItems:
        'center',

      gap:
        8,
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
    },

    tenantName: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '700',

      marginTop:
        8,
    },

    pendingText: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        8,
    },

    area: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        7,
    },
  });