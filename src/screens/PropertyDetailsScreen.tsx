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
  useRoute,
} from '@react-navigation/native';

import {
  useTranslation,
} from 'react-i18next';

import {
  Badge,
  Card,
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  SwipeActions,
} from '../components/SwipeActions';

import {
  useApp,
} from '../context/AppContext';

import {
  loadPropertyHistory,
  PropertyHistoryItem,
} from '../services/propertyHistoryService';

import {
  getPropertyTenancy,
  PropertyTenancySummary,
} from '../services/tenantRepository';

import {
  Meter,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  value?: string,
) {
  if (
    !value
  ) {
    return '—';
  }

  const date =
    new Date(
      `${value}T00:00:00`,
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

function formatHistoryDate(
  iso: string,
) {
  const date =
    new Date(
      iso,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return date.toLocaleString(
    undefined,
    {
      day:
        '2-digit',

      month:
        'short',

      hour:
        '2-digit',

      minute:
        '2-digit',
    },
  );
}

function getLatestReading(
  meter:
    Meter,
) {
  const registers =
    meter.registers.filter(
      register =>
        register.lastReadingAt &&
        register.lastValue !==
          undefined,
    );

  if (
    registers.length ===
    0
  ) {
    return null;
  }

  const latestTimestamp =
    registers.reduce(
      (
        latest,
        register,
      ) => {
        const timestamp =
          new Date(
            register.lastReadingAt!,
          ).getTime();

        return Math.max(
          latest,
          timestamp,
        );
      },
      0,
    );

  const values =
    registers
      .map(
        register => {
          if (
            meter.registers.length >
            1
          ) {
            return `${register.code}: ${register.lastValue} ${register.unit}`;
          }

          return `${register.lastValue} ${register.unit}`;
        },
      )
      .join(
        ' • ',
      );

  return {
    date:
      new Date(
        latestTimestamp,
      ).toISOString(),

    values,
  };
}

function historyTone(
  category:
    PropertyHistoryItem['category'],
) {
  switch (
    category
  ) {
    case 'PAYMENT':
      return 'success' as const;

    case 'INVOICE':
      return 'warning' as const;

    case 'READING':
      return 'success' as const;

    case 'TENANT':
      return 'neutral' as const;

    default:
      return 'neutral' as const;
  }
}

function tenancyBadge(
  tenancy:
    PropertyTenancySummary | null,
) {
  if (
    !tenancy
  ) {
    return {
      text:
        'Available',

      tone:
        'neutral' as const,
    };
  }

  if (
    tenancy.status ===
    'CHECKOUT_PENDING'
  ) {
    return {
      text:
        'Checkout required',

      tone:
        'warning' as const,
    };
  }

  if (
    tenancy.status ===
    'PENDING'
  ) {
    return {
      text:
        'Invitation pending',

      tone:
        'warning' as const,
    };
  }

  return {
    text:
      'Occupied',

    tone:
      'success' as const,
  };
}

export function PropertyDetailsScreen() {
  const {
    t,
  } =
    useTranslation();

  const route =
    useRoute<any>();

  const navigation =
    useNavigation<any>();

  const {
    state,
    removeMeter,
    generateInvoice,
  } =
    useApp();

  const propertyId =
    route.params
      ?.propertyId as string;

  const property =
    state.properties.find(
      item =>
        item.id ===
        propertyId,
    );

  const [
    tenancy,
    setTenancy,
  ] =
    useState<
      PropertyTenancySummary | null
    >(null);

  const [
    tenancyLoading,
    setTenancyLoading,
  ] =
    useState(true);

  const [
    history,
    setHistory,
  ] =
    useState<
      PropertyHistoryItem[]
    >([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  /*
   * Reload tenancy + history whenever we return
   * to the apartment screen.
   *
   * This means editing tenant information is
   * reflected immediately after pressing Back.
   */
  useFocusEffect(
    useCallback(
      () => {
        if (
          !propertyId
        ) {
          return;
        }

        let active =
          true;

        const load =
          async () => {
            setTenancyLoading(
              true,
            );

            setHistoryLoading(
              true,
            );

            try {
              const [
                tenancyData,
                historyData,
              ] =
                await Promise.all([
                  getPropertyTenancy(
                    propertyId,
                  ),

                  loadPropertyHistory(
                    propertyId,
                    30,
                  ),
                ]);

              if (
                !active
              ) {
                return;
              }

              setTenancy(
                tenancyData,
              );

              setHistory(
                historyData,
              );
            } catch (
              error
            ) {
              console.error(
                '[Dometra] Unable to load property details:',
                error,
              );
            } finally {
              if (
                active
              ) {
                setTenancyLoading(
                  false,
                );

                setHistoryLoading(
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
        propertyId,
      ],
    ),
  );

  if (
    !property
  ) {
    return (
      <Screen>
        <Header
          title="Apartment"
          subtitle="Apartment not found"
        />
      </Screen>
    );
  }

  const meters =
    state.meters.filter(
      meter =>
        meter.propertyId ===
        property.id,
    );

  const invoices =
    state.invoices.filter(
      invoice =>
        invoice.propertyId ===
        property.id,
    );

  const statusBadge =
    tenancyBadge(
      tenancy,
    );

  const confirmRemoveMeter =
    (
      meterId:
        string,

      meterName:
        string,
    ) => {
      Alert.alert(
        'Remove meter / service?',
        `Are you sure you want to remove "${meterName}"?`,
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
                void removeMeter(
                  meterId,
                );
              },
          },
        ],
      );
    };

  const openTenant =
    () => {
      if (
        !tenancy
      ) {
        return;
      }

      navigation.navigate(
        'TenantDetails',
        {
          propertyId:
            property.id,
        },
      );
    };

  const editManualTenant =
    () => {
      if (
        !tenancy ||
        tenancy.tenantType !==
          'MANUAL'
      ) {
        return;
      }

      navigation.navigate(
        'TenantProfile',
        {
          mode:
            'EDIT_MANUAL',

          propertyId:
            property.id,
        },
      );
    };

  const createInvoice =
    () => {
      try {
        const invoice =
          generateInvoice(
            property.id,
          );

        Alert.alert(
          t(
            'invoiceCreated',
          ),
        );

        navigation.navigate(
          'InvoiceDetails',
          {
            invoiceId:
              invoice.id,
          },
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Invoices',

          error instanceof
          Error
            ? error.message
            : 'Unable to create invoice.',
        );
      }
    };

  return (
    <Screen>
      {/*
       * No separate "Apartment / City" card.
       *
       * Everything needed is already visible
       * in the header.
       */}

      <Header
        title={
          property.name
        }
        subtitle={`${property.address}, ${property.city}`}
        right={
          <Badge
            text={
              statusBadge.text
            }
            tone={
              statusBadge.tone
            }
          />
        }
      />

      {/*
       * ======================================================
       * TENANT
       * ======================================================
       */}

      <SectionTitle
        title="Tenant"
      />

      {tenancyLoading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading tenant...
          </Text>
        </Card>
      ) : null}

      {!tenancyLoading &&
      !tenancy ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No tenant assigned
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Add a manual tenant or invite a Dometra user.
          </Text>

          <View
            style={
              styles.buttonTop
            }
          >
            <PrimaryButton
              title="+ Add tenant"
              onPress={() =>
                navigation.navigate(
                  'AddTenantMethod',
                  {
                    propertyId:
                      property.id,
                  },
                )
              }
            />
          </View>
        </Card>
      ) : null}

      {!tenancyLoading &&
      tenancy ? (
        <Pressable
          onPress={
            openTenant
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
                {tenancy.tenant ? (
                  <>
                    <View
                      style={
                        styles.tenantTitleRow
                      }
                    >
                      <Text
                        style={
                          styles.tenantName
                        }
                      >
                        {
                          tenancy.tenant.firstName
                        }{' '}
                        {
                          tenancy.tenant.lastName
                        }
                      </Text>

                      <Badge
                        text={
                          tenancy.tenantType ===
                          'MANUAL'
                            ? 'Manual'
                            : 'Dometra'
                        }
                        tone="neutral"
                      />
                    </View>

                    <Text
                      style={
                        styles.tenantContact
                      }
                    >
                      {
                        tenancy.tenant.phone
                      }
                    </Text>

                    <Text
                      style={
                        styles.tenantContact
                      }
                    >
                      {
                        tenancy.tenant.email
                      }
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={
                        styles.tenantName
                      }
                    >
                      Tenant invitation
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      Waiting for the tenant to accept the invitation.
                    </Text>
                  </>
                )}
              </View>

              <Text
                style={
                  styles.chevron
                }
              >
                ›
              </Text>
            </View>

            <View
              style={
                styles.separator
              }
            />

            <View
              style={
                styles.rentalRow
              }
            >
              <View
                style={
                  styles.rentalCell
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
                    styles.rentalValue
                  }
                >
                  {
                    tenancy.rentAmount
                  }{' '}
                  {
                    tenancy.currency
                  }
                </Text>
              </View>

              <View
                style={
                  styles.rentalCell
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  Since
                </Text>

                <Text
                  style={
                    styles.rentalValue
                  }
                >
                  {formatDate(
                    tenancy.startDate,
                  )}
                </Text>
              </View>
            </View>

            {tenancy.endDate ? (
              <View
                style={
                  styles.contractInfo
                }
              >
                <Text
                  style={
                    styles.muted
                  }
                >
                  Agreement until{' '}
                  {formatDate(
                    tenancy.endDate,
                  )}
                </Text>

                {tenancy.autoProlongation ? (
                  <Badge
                    text="Auto-prolongation"
                    tone="success"
                  />
                ) : null}
              </View>
            ) : null}

            {tenancy.tenantType ===
            'MANUAL' ? (
              <View
                style={
                  styles.buttonTop
                }
              >
                <SecondaryButton
                  title="Edit tenant"
                  onPress={
                    editManualTenant
                  }
                />
              </View>
            ) : null}
          </Card>
        </Pressable>
      ) : null}

      {/*
       * ======================================================
       * METERS
       * ======================================================
       */}

      <SectionTitle
        title="Meters & services"
      />

      {meters.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No meters or services yet.
          </Text>
        </Card>
      ) : null}

      {meters.map(
        meter => {
          const latestReading =
            getLatestReading(
              meter,
            );

          return (
            <SwipeActions
              key={
                meter.id
              }
              onEdit={() =>
                navigation.navigate(
                  'AddMeter',
                  {
                    propertyId:
                      property.id,

                    meterId:
                      meter.id,
                  },
                )
              }
              onRemove={() =>
                confirmRemoveMeter(
                  meter.id,
                  meter.name,
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
                        styles.value
                      }
                    >
                      {
                        meter.name
                      }
                    </Text>

                    {meter.billingMode ===
                    'METERED' ? (
                      <>
                        <Text
                          style={
                            styles.muted
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

                        {latestReading ? (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Badge
                              text={`Last ${formatDate(
                                latestReading.date.slice(
                                  0,
                                  10,
                                ),
                              )}`}
                              tone="success"
                            />

                            <Text
                              style={
                                styles.lastReadingValue
                              }
                            >
                              {
                                latestReading.values
                              }
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Badge
                              text="No readings yet"
                              tone="neutral"
                            />
                          </View>
                        )}
                      </>
                    ) : null}

                    {meter.billingMode ===
                    'FIXED' ? (
                      <Text
                        style={
                          styles.muted
                        }
                      >
                        Fixed •{' '}
                        {
                          meter.fixedAmount
                        }{' '}
                        {
                          meter.billingCurrency ??
                          'UAH'
                        }{' '}
                        / month
                      </Text>
                    ) : null}

                    {meter.billingMode ===
                    'VARIABLE' ? (
                      <>
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          Variable service
                        </Text>

                        {meter.lastAmount !==
                        undefined ? (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Text
                              style={
                                styles.lastReadingValue
                              }
                            >
                              {
                                meter.lastAmount
                              }{' '}
                              {
                                meter.billingCurrency ??
                                'UAH'
                              }
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>

                  {meter.billingMode ===
                  'METERED' ? (
                    <SecondaryButton
                      title="Reading"
                      onPress={() =>
                        navigation.navigate(
                          'MeterReading',
                          {
                            meterId:
                              meter.id,
                          },
                        )
                      }
                    />
                  ) : null}

                  {meter.billingMode ===
                  'VARIABLE' ? (
                    <SecondaryButton
                      title="Enter value"
                      onPress={() =>
                        navigation.navigate(
                          'MeterReading',
                          {
                            meterId:
                              meter.id,
                          },
                        )
                      }
                    />
                  ) : null}
                </View>
              </Card>
            </SwipeActions>
          );
        },
      )}

      <SecondaryButton
        title="+ Add meter / service"
        onPress={() =>
          navigation.navigate(
            'AddMeter',
            {
              propertyId:
                property.id,
            },
          )
        }
      />

      {/*
       * ======================================================
       * HISTORY
       * ======================================================
       */}

      <SectionTitle
        title="History"
      />

      {historyLoading &&
      history.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading history...
          </Text>
        </Card>
      ) : null}

      {!historyLoading &&
      history.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            No activity yet.
          </Text>
        </Card>
      ) : null}

      {history.map(
        item => (
          <View
            key={
              item.id
            }
            style={
              styles.historyRow
            }
          >
            <View
              style={
                styles.historyLineColumn
              }
            >
              <View
                style={
                  styles.historyDot
                }
              />

              <View
                style={
                  styles.historyLine
                }
              />
            </View>

            <View
              style={
                styles.historyContent
              }
            >
              <View
                style={
                  styles.historyHeader
                }
              >
                <Text
                  style={
                    styles.historyTitle
                  }
                >
                  {
                    item.title
                  }
                </Text>

                <Badge
                  text={
                    item.category
                  }
                  tone={
                    historyTone(
                      item.category,
                    )
                  }
                />
              </View>

              {item.details ? (
                <Text
                  style={
                    styles.historyDetails
                  }
                >
                  {
                    item.details
                  }
                </Text>
              ) : null}

              <Text
                style={
                  styles.historyDate
                }
              >
                {formatHistoryDate(
                  item.timestamp,
                )}
              </Text>
            </View>
          </View>
        ),
      )}

      {/*
       * ======================================================
       * INVOICES
       * ======================================================
       */}

      <SectionTitle
        title={
          t(
            'invoices',
          )
        }
      />

      {invoices
        .slice(
          0,
          3,
        )
        .map(
          invoice => (
            <Card
              key={
                invoice.id
              }
            >
              <View
                style={
                  styles.rowBetween
                }
              >
                <View>
                  <Text
                    style={
                      styles.value
                    }
                  >
                    {
                      invoice.period
                    }
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {
                      invoice.status
                    }
                  </Text>
                </View>

                <SecondaryButton
                  title={
                    t(
                      'invoice',
                    )
                  }
                  onPress={() =>
                    navigation.navigate(
                      'InvoiceDetails',
                      {
                        invoiceId:
                          invoice.id,
                      },
                    )
                  }
                />
              </View>
            </Card>
          ),
        )}

      <PrimaryButton
        title={
          t(
            'generateInvoice',
          )
        }
        onPress={
          createInvoice
        }
      />
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

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    emptyTitle: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },

    tenantTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        8,
    },

    tenantName: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '800',
    },

    tenantContact: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        4,
    },

    chevron: {
      color:
        colors.muted,

      fontSize:
        28,

      fontWeight:
        '300',
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    rentalRow: {
      flexDirection:
        'row',

      gap:
        spacing.md,
    },

    rentalCell: {
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

    rentalValue: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',

      marginTop:
        4,
    },

    contractInfo: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      flexWrap:
        'wrap',

      gap:
        8,

      marginTop:
        spacing.md,
    },

    value: {
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
        12,

      marginTop:
        4,

      lineHeight:
        18,
    },

    lastReading: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      alignItems:
        'center',

      gap:
        8,

      marginTop:
        10,
    },

    lastReadingValue: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    historyRow: {
      flexDirection:
        'row',

      minHeight:
        78,
    },

    historyLineColumn: {
      width:
        22,

      alignItems:
        'center',
    },

    historyDot: {
      width:
        10,

      height:
        10,

      borderRadius:
        5,

      backgroundColor:
        colors.primary,

      marginTop:
        7,
    },

    historyLine: {
      width:
        1,

      flex:
        1,

      backgroundColor:
        colors.border,

      marginTop:
        5,
    },

    historyContent: {
      flex:
        1,

      paddingLeft:
        spacing.sm,

      paddingBottom:
        spacing.md,
    },

    historyHeader: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.sm,
    },

    historyTitle: {
      flex:
        1,

      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    historyDetails: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        4,
    },

    historyDate: {
      color:
        colors.muted,

      fontSize:
        11,

      marginTop:
        5,
    },
  });