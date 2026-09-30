import React from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
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
  colors,
  spacing,
} from '../theme';

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

  const confirmRemove =
    (
      propertyId:
        string,

      propertyName:
        string,
    ) => {
      Alert.alert(
        'Remove apartment?',
        `Are you sure you want to remove "${propertyName}"?\n\nMeters, invoices, payments and reminders linked to this apartment will also be removed.`,

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
                removeProperty(
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
        ) => (
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
                      }
                      {', '}
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
                          property.tenantName
                            ? t(
                                'occupied',
                              )
                            : t(
                                'vacant',
                              )
                        }
                        tone={
                          property.tenantName
                            ? 'success'
                            : 'neutral'
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
                  </View>

                  {property.rentAmount >
                  0 ? (
                    <Money
                      amount={
                        property.rentAmount
                      }
                      currency={
                        property.rentCurrency
                      }
                      strong
                    />
                  ) : null}
                </View>
              </Card>
            </Pressable>
          </SwipeActions>
        ),
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
  });