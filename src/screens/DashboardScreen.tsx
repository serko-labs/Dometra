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
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  PropertyThumbnail,
} from '../components/PropertyThumbnail';

import {
  LandlordPortfolioStatistics,
  LandlordPropertyPaymentSummary,
  loadLandlordPortfolioStatistics,
} from '../services/landlordPortfolioRepository';

import {
  loadPropertyIcons,
  PropertyIcon,
} from '../services/propertyIconRepository';

import {
  colors,
  spacing,
} from '../theme';

type PropertyFilter =
  | 'ALL'
  | 'OCCUPIED'
  | 'VACANT';

function paymentBadge(
  property:
    LandlordPropertyPaymentSummary,
) {
  if (
    property.paymentState ===
    'VACANT'
  ) {
    return (
      <Badge
        text="Vacant"
        tone="neutral"
      />
    );
  }

  if (
    property.paymentState ===
    'PAID'
  ) {
    return (
      <PaymentStatusBadge
        state="PAID"
        text="Paid"
      />
    );
  }

  if (
    property.paymentState ===
    'DELAYED'
  ) {
    return (
      <PaymentStatusBadge
        state="OVERDUE"
        text="Delayed"
      />
    );
  }

  return (
    <PaymentStatusBadge
      state="DUE"
      text="Pending"
    />
  );
}

function rentText(
  property:
    LandlordPropertyPaymentSummary,
) {
  if (
    property.rentAmount ===
      undefined ||
    !property.rentCurrency
  ) {
    return '—';
  }

  return `${property.rentAmount.toLocaleString(
    undefined,
    {
      maximumFractionDigits:
        2,
    },
  )} ${property.rentCurrency}`;
}

function FilterButton({
  title,
  selected,
  onPress,
}: {
  title:
    string;

  selected:
    boolean;

  onPress:
    () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.filterButton,

        selected &&
          styles.filterButtonSelected,

        pressed &&
          styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterButtonText,

          selected &&
            styles.filterButtonTextSelected,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function DashboardScreen() {
  const navigation =
    useNavigation<any>();

  const [
    portfolio,
    setPortfolio,
  ] =
    useState<
      LandlordPortfolioStatistics | null
    >(null);

  const [
    propertyIcons,
    setPropertyIcons,
  ] =
    useState<
      Record<
        string,
        PropertyIcon
      >
    >({});

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    filter,
    setFilter,
  ] =
    useState<PropertyFilter>(
      'ALL',
    );

  const reload =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const data =
            await loadLandlordPortfolioStatistics();

          const icons =
            await loadPropertyIcons(
              data.properties.map(
                property =>
                  property.propertyId,
              ),
            );

          setPortfolio(
            data,
          );

          setPropertyIcons(
            icons,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Home',

            error instanceof
            Error
              ? error.message
              : 'Unable to load your properties.',
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

  const properties =
    useMemo(
      () => {
        if (
          !portfolio
        ) {
          return [];
        }

        if (
          filter ===
          'OCCUPIED'
        ) {
          return portfolio.properties.filter(
            property =>
              Boolean(
                property.tenancyId,
              ),
          );
        }

        if (
          filter ===
          'VACANT'
        ) {
          return portfolio.properties.filter(
            property =>
              !property.tenancyId,
          );
        }

        return portfolio.properties;
      },

      [
        portfolio,
        filter,
      ],
    );

  const openProperty =
    (
      propertyId:
        string,
    ) => {
      navigation.navigate(
        'PropertyDetails',

        {
          propertyId,
        },
      );
    };

  const openPropertyIcon =
    (
      property:
        LandlordPropertyPaymentSummary,
    ) => {
      navigation.navigate(
        'PropertyIcon',

        {
          propertyId:
            property.propertyId,

          propertyName:
            property.propertyName,

          propertyAddress:
            `${property.propertyAddress}, ${property.propertyCity}`,
        },
      );
    };

  return (
    <Screen>
      <Header
        title="Home"
        subtitle="Your rental properties"
      />

      <PrimaryButton
        title="+ Add property"
        onPress={() =>
          navigation.navigate(
            'AddProperty',
          )
        }
      />

      {portfolio &&
      portfolio.totalProperties >
        0 ? (
        <View
          style={
            styles.filters
          }
        >
          <FilterButton
            title={`All (${portfolio.totalProperties})`}
            selected={
              filter ===
              'ALL'
            }
            onPress={() =>
              setFilter(
                'ALL',
              )
            }
          />

          <FilterButton
            title={`Occupied (${portfolio.occupiedProperties})`}
            selected={
              filter ===
              'OCCUPIED'
            }
            onPress={() =>
              setFilter(
                'OCCUPIED',
              )
            }
          />

          <FilterButton
            title={`Vacant (${portfolio.vacantProperties})`}
            selected={
              filter ===
              'VACANT'
            }
            onPress={() =>
              setFilter(
                'VACANT',
              )
            }
          />
        </View>
      ) : null}

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading properties...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      portfolio &&
      portfolio.properties.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No properties yet
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Add your first apartment to start managing tenants, meters and monthly payments.
          </Text>
        </Card>
      ) : null}

      {!loading &&
      portfolio &&
      portfolio.properties.length >
        0 &&
      properties.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No properties
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            There are no apartments matching this filter.
          </Text>
        </Card>
      ) : null}

      {!loading &&
      properties.map(
        property => (
          <Pressable
            key={
              property.propertyId
            }
            onPress={() =>
              openProperty(
                property.propertyId,
              )
            }
            style={({
              pressed,
            }) => [
              styles.propertyPressable,

              pressed &&
                styles.pressed,
            ]}
          >
            <Card>
              <View
                style={
                  styles.topRow
                }
              >
                <Pressable
                  onPress={
                    event => {
                      event.stopPropagation();

                      openPropertyIcon(
                        property,
                      );
                    }
                  }
                  hitSlop={
                    8
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.thumbnailButton,

                    pressed &&
                      styles.thumbnailPressed,
                  ]}
                >
                  <PropertyThumbnail
                    uri={
                      propertyIcons[
                        property.propertyId
                      ]?.uri
                    }
                    size={
                      72
                    }
                    editable
                  />
                </Pressable>

                <View
                  style={
                    styles.flex
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
                          styles.propertyName
                        }
                      >
                        {
                          property.propertyName
                        }
                      </Text>

                      <Text
                        style={
                          styles.address
                        }
                      >
                        {
                          property.propertyAddress
                        }
                        ,{' '}
                        {
                          property.propertyCity
                        }
                      </Text>

                      {property.areaM2 >
                      0 ? (
                        <Text
                          style={
                            styles.meta
                          }
                        >
                          {
                            property.areaM2
                          }{' '}
                          m²
                          {'  •  '}
                          {property.tenancyId
                            ? 'Occupied'
                            : 'No active tenant'}
                        </Text>
                      ) : (
                        <Text
                          style={
                            styles.meta
                          }
                        >
                          {property.tenancyId
                            ? 'Occupied'
                            : 'No active tenant'}
                        </Text>
                      )}
                    </View>

                    {paymentBadge(
                      property,
                    )}
                  </View>
                </View>
              </View>

              {property.tenancyId ? (
                <>
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
                        Rent
                      </Text>

                      <Text
                        style={
                          styles.value
                        }
                      >
                        {rentText(
                          property,
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
                        Payment due
                      </Text>

                      <Text
                        style={
                          styles.value
                        }
                      >
                        Day{' '}
                        {property.paymentDueDay ??
                          5}
                      </Text>
                    </View>
                  </View>

                  {!property.billingReady ? (
                    <Text
                      style={
                        styles.billingHint
                      }
                    >
                      {property.billingMissingCount}{' '}
                      billing item
                      {property.billingMissingCount ===
                      1
                        ? ''
                        : 's'}{' '}
                      still need data for this month.
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <View
                    style={
                      styles.separator
                    }
                  />

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    Open the apartment to add or invite a tenant.
                  </Text>
                </>
              )}

              <Text
                style={
                  styles.openText
                }
              >
                Open apartment ›
              </Text>
            </Card>
          </Pressable>
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

    filters: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        8,

      marginTop:
        spacing.md,

      marginBottom:
        spacing.md,
    },

    filterButton: {
      minHeight:
        36,

      justifyContent:
        'center',

      paddingHorizontal:
        13,

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        999,
    },

    filterButtonSelected: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primary,
    },

    filterButtonText: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    filterButtonTextSelected: {
      color:
        '#FFFFFF',
    },

    propertyPressable: {
      marginBottom:
        spacing.sm,
    },

    pressed: {
      opacity:
        0.72,
    },

    thumbnailPressed: {
      opacity:
        0.72,
    },

    thumbnailButton: {
      alignSelf:
        'flex-start',
    },

    topRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        spacing.md,
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

    meta: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        6,
    },

    separator: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,

      marginTop:
        spacing.md,

      paddingTop:
        spacing.md,
    },

    infoGrid: {
      flexDirection:
        'row',

      gap:
        spacing.md,
    },

    infoCell: {
      flex:
        1,
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
        15,

      fontWeight:
        '800',

      marginTop:
        4,
    },

    billingHint: {
      color:
        '#92400E',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '600',

      marginTop:
        spacing.md,
    },

    openText: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '800',

      marginTop:
        spacing.md,
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,
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
  });