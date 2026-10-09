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
  Badge,
  Card,
  Header,
  Screen,
} from '../components/ui';

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

function hasOutstanding(
  rental:
    TenantRentalHistoryItem,
) {
  return rental.balances.some(
    balance =>
      balance.outstanding >
      0.009,
  );
}

function RentalCard({
  rental,
  onPress,
}: {
  rental:
    TenantRentalHistoryItem;

  onPress:
    () => void;
}) {
  const outstanding =
    hasOutstanding(
      rental,
    );

  return (
    <Pressable
      onPress={
        onPress
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
                rental.propertyName
              }
            </Text>

            <Text
              style={
                styles.address
              }
            >
              {
                rental.propertyAddress
              }
              ,{' '}
              {
                rental.propertyCity
              }
            </Text>
          </View>

          <Badge
            text={
              outstanding
                ? 'Outstanding'
                : 'Ended'
            }
            tone={
              outstanding
                ? 'warning'
                : 'neutral'
            }
          />
        </View>

        <View
          style={
            styles.periodBox
          }
        >
          <View
            style={
              styles.periodCell
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Started
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {formatDate(
                rental.startDate,
              )}
            </Text>
          </View>

          <View
            style={
              styles.periodCell
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Ended
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {formatDate(
                rental.endDate,
              )}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.footerRow
          }
        >
          <Text
            style={
              styles.rent
            }
          >
            {
              rental.rentAmount
            }{' '}
            {
              rental.currency
            }{' '}
            / month
          </Text>

          <Text
            style={
              styles.openText
            }
          >
            View ›
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export function PreviousRentalsScreen() {
  const navigation =
    useNavigation<any>();

  const [
    rentals,
    setRentals,
  ] =
    useState<
      TenantRentalHistoryItem[]
    >([]);

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
          setRentals(
            await loadTenantRentalHistory(),
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Previous rentals',

            error instanceof
            Error
              ? error.message
              : 'Unable to load previous rentals.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
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

  return (
    <Screen>
      <Header
        title="Previous rentals"
        subtitle="Your completed tenancies"
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading rental history...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      rentals.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No previous rentals
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Apartments will appear here after a tenancy has been completed.
          </Text>
        </Card>
      ) : null}

      {!loading &&
      rentals.map(
        rental => (
          <RentalCard
            key={
              rental.tenancyId
            }
            rental={
              rental
            }
            onPress={() =>
              navigation.navigate(
                'PreviousRentalDetails',
                {
                  tenancyId:
                    rental.tenancyId,
                },
              )
            }
          />
        ),
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

    pressable: {
      marginBottom:
        spacing.sm,
    },

    pressed: {
      opacity:
        0.72,
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
        18,

      fontWeight:
        '900',
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

    periodBox: {
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

    periodCell: {
      flex:
        1,
    },

    label: {
      color:
        colors.muted,

      fontSize:
        10,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    value: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '700',

      marginTop:
        4,
    },

    footerRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      marginTop:
        spacing.md,
    },

    rent: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    openText: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '800',
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

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,
    },
  });