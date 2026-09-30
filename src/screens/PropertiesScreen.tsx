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
  PrimaryButton,
  Screen,
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

export function PropertiesScreen() {
  const {
    t,
  } =
    useTranslation();

  const navigation =
    useNavigation<any>();

  const {
    state,
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

  useFocusEffect(
    useCallback(
      () => {
        let active =
          true;

        const load =
          async () => {
            try {
              const data =
                await loadPropertyOccupancy(
                  state.properties.map(
                    (
                      property,
                    ) =>
                      property.id,
                  ),
                );

              if (
                active
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
          active =
            false;
        };
      },
      [
        state.properties,
      ],
    ),
  );

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
        title={
          t(
            'properties',
          )
        }
        subtitle={`${state.properties.length} / 4`}
      />

      <PrimaryButton
        title={`+ ${t(
          'addProperty',
        )}`}
        onPress={() =>
          navigation.navigate(
            'AddProperty',
          )
        }
      />

      {state.properties.map(
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
                      styles.row
                    }
                  >
                    <View
                      style={
                        styles.icon
                      }
                    >
                      <Text
                        style={
                          styles.iconText
                        }
                      >
                        ⌂
                      </Text>
                    </View>

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
                          property.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.address
                        }
                      >
                        {
                          property.address
                        },{' '}
                        {
                          property.city
                        }
                      </Text>

                      <View
                        style={
                          styles.meta
                        }
                      >
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

                      {currentOccupancy
                        ?.state ===
                        'OCCUPIED' &&
                      currentOccupancy
                        .tenantName ? (
                        <Text
                          style={
                            styles.tenant
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
                            styles.pending
                          }
                        >
                          Waiting for tenant to accept
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
    row: {
      flexDirection:
        'row',

      gap:
        spacing.md,

      alignItems:
        'center',
    },

    flex: {
      flex:
        1,
    },

    icon: {
      width:
        46,

      height:
        46,

      borderRadius:
        14,

      backgroundColor:
        colors.primarySoft,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    iconText: {
      fontSize:
        22,

      color:
        colors.primary,
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

      marginTop:
        3,
    },

    meta: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        9,

      marginTop:
        9,
    },

    area: {
      color:
        colors.muted,

      fontSize:
        12,
    },

    tenant: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '700',

      marginTop:
        8,
    },

    pending: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        8,
    },
  });