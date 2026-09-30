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
  Money,
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
  revokeTenantInvitation,
} from '../services/tenantRepository';

import {
  Meter,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  iso: string,
) {
  const date =
    new Date(iso);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return iso;
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
    new Date(iso);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return iso;
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
  meter: Meter,
) {
  const registers =
    meter.registers.filter(
      (
        register,
      ) =>
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
      ) =>
        Math.max(
          latest,
          new Date(
            register.lastReadingAt!,
          ).getTime(),
        ),
      0,
    );

  return {
    date:
      new Date(
        latestTimestamp,
      ).toISOString(),

    values:
      registers
        .map(
          (
            register,
          ) =>
            meter.registers.length >
            1
              ? `${register.code}: ${register.lastValue} ${register.unit}`
              : `${register.lastValue} ${register.unit}`,
        )
        .join(' • '),
  };
}

function historyTone(
  category:
    PropertyHistoryItem['category'],
) {
  if (
    category === 'PAYMENT' ||
    category === 'READING'
  ) {
    return 'success' as const;
  }

  if (
    category === 'INVOICE'
  ) {
    return 'warning' as const;
  }

  return 'neutral' as const;
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

  const property =
    state.properties.find(
      (
        item,
      ) =>
        item.id ===
        route.params
          ?.propertyId,
    );

  const [
    tenancy,
    setTenancy,
  ] =
    useState<
      PropertyTenancySummary | null
    >(null);

  const [
    history,
    setHistory,
  ] =
    useState<
      PropertyHistoryItem[]
    >([]);

  const [
    detailsLoading,
    setDetailsLoading,
  ] =
    useState(false);

  const propertyId =
    property?.id;

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
            setDetailsLoading(true);

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
                active
              ) {
                setTenancy(
                  tenancyData,
                );

                setHistory(
                  historyData,
                );
              }
            } catch (
              error
            ) {
              console.error(
                '[Dometra] Unable to load apartment details:',
                error,
              );
            } finally {
              if (
                active
              ) {
                setDetailsLoading(false);
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
        <Text>
          Property not found
        </Text>
      </Screen>
    );
  }

  const meters =
    state.meters.filter(
      (
        meter,
      ) =>
        meter.propertyId ===
        property.id,
    );

  const invoices =
    state.invoices.filter(
      (
        invoice,
      ) =>
        invoice.propertyId ===
        property.id,
    );

  const confirmRemoveMeter =
    (
      meterId: string,
      meterName: string,
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

  const revokeInvitation =
    () => {
      if (
        !tenancy?.invitation
      ) {
        return;
      }

      Alert.alert(
        'Revoke invitation?',
        'The current invitation will stop working.',
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },
          {
            text:
              'Revoke',
            style:
              'destructive',
            onPress:
              () => {
                void (
                  async () => {
                    try {
                      await revokeTenantInvitation(
                        tenancy.invitation!.id,
                      );

                      setTenancy(null);

                      setHistory(
                        await loadPropertyHistory(
                          property.id,
                          30,
                        ),
                      );
                    } catch (
                      error
                    ) {
                      Alert.alert(
                        'Unable to revoke invitation',
                        error instanceof Error
                          ? error.message
                          : 'Unknown error.',
                      );
                    }
                  }
                )();
              },
          },
        ],
      );
    };

  const createInvoice =
    () => {
      try {
        const invoice =
          generateInvoice(
            property.id,
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
          error instanceof Error
            ? error.message
            : 'Unable to create invoice.',
        );
      }
    };

  return (
    <Screen>
      <Header
        title={
          property.name
        }
        subtitle={`${property.address}, ${property.city}`}
        right={
          <Badge
            text={
              tenancy?.status ===
                'ACTIVE'
                ? t(
                    'occupied',
                  )
                : tenancy?.status ===
                    'PENDING'
                  ? 'Pending'
                  : t(
                      'vacant',
                    )
            }
            tone={
              tenancy?.status ===
              'ACTIVE'
                ? 'success'
                : tenancy?.status ===
                    'PENDING'
                  ? 'warning'
                  : 'neutral'
            }
          />
        }
      />

      <Card>
        <View
          style={
            styles.infoGrid
          }
        >
          {property.areaM2 >
          0 ? (
            <View>
              <Text
                style={
                  styles.label
                }
              >
                Square
              </Text>

              <Text
                style={
                  styles.value
                }
              >
                {property.areaM2} m²
              </Text>
            </View>
          ) : (
            <View>
              <Text
                style={
                  styles.label
                }
              >
                Apartment
              </Text>

              <Text
                style={
                  styles.value
                }
              >
                {property.city}
              </Text>
            </View>
          )}
        </View>
      </Card>

      <SectionTitle
        title="Tenant"
      />

      {detailsLoading &&
      !tenancy ? (
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

      {!detailsLoading &&
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
            Add a tenant manually or invite an existing Dometra user.
          </Text>

          <View
            style={
              styles.buttonTop
            }
          >
            <SecondaryButton
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

      {tenancy ? (
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
                {tenancy.tenant
                  ? `${tenancy.tenant.firstName} ${tenancy.tenant.lastName}`
                  : 'Tenant invitation'}
              </Text>

              {tenancy.tenant ? (
                <>
                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {tenancy.tenant.phone}
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {tenancy.tenant.email}
                  </Text>
                </>
              ) : (
                <Text
                  style={
                    styles.muted
                  }
                >
                  Waiting for a Dometra user to accept the invitation.
                </Text>
              )}
            </View>

            <Badge
              text={
                tenancy.tenantType ===
                  'MANUAL'
                  ? 'Manual'
                  : tenancy.tenantType ===
                      'DOMETRA'
                    ? 'Dometra'
                    : 'Invited'
              }
              tone={
                tenancy.status ===
                'ACTIVE'
                  ? 'success'
                  : 'warning'
              }
            />
          </View>

          <View
            style={
              styles.separator
            }
          />

          <View
            style={
              styles.rowBetween
            }
          >
            <View>
              <Text
                style={
                  styles.label
                }
              >
                Rent
              </Text>

              <Money
                amount={
                  tenancy.rentAmount
                }
                currency={
                  tenancy.currency
                }
                strong
              />
            </View>

            <View
              style={
                styles.alignRight
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
                  styles.valueSmall
                }
              >
                {formatDate(
                  tenancy.startDate,
                )}
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.muted
            }
          >
            Payment due on day {tenancy.paymentDueDay} of each month.
          </Text>

          {tenancy.status ===
            'PENDING' &&
          tenancy.invitation ? (
            <View
              style={
                styles.buttonTop
              }
            >
              <SecondaryButton
                title="Revoke invitation"
                onPress={
                  revokeInvitation
                }
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      <SectionTitle
        title="Meters & services"
      />

      {meters.map(
        (
          meter,
        ) => {
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
                      {meter.name}
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
                              (
                                register,
                              ) =>
                                `${register.tariff} ${register.tariffCurrency}/${register.unit}`,
                            )
                            .join(' • ')}
                        </Text>

                        {latestReading ? (
                          <View
                            style={
                              styles.lastReading
                            }
                          >
                            <Badge
                              text={`Last ${formatDate(
                                latestReading.date,
                              )}`}
                              tone="success"
                            />

                            <Text
                              style={
                                styles.lastReadingValue
                              }
                            >
                              {latestReading.values}
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
                        Fixed • {meter.fixedAmount} {meter.billingCurrency ?? 'UAH'} / month
                      </Text>
                    ) : null}

                    {meter.billingMode ===
                    'VARIABLE' ? (
                      <Text
                        style={
                          styles.muted
                        }
                      >
                        Variable service
                      </Text>
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

      <SectionTitle
        title="History"
      />

      {history.length ===
      0 ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            {detailsLoading
              ? 'Loading history...'
              : 'No activity yet.'}
          </Text>
        </Card>
      ) : null}

      {history.map(
        (
          item,
        ) => (
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
                  {item.title}
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
                  {item.details}
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
          (
            invoice,
          ) => (
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
                    {invoice.period}
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    {invoice.status}
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

    infoGrid: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap:
        spacing.md,
    },

    flex: {
      flex:
        1,
    },

    alignRight: {
      alignItems:
        'flex-end',
    },

    label: {
      color:
        colors.muted,
      fontSize:
        12,
    },

    value: {
      color:
        colors.text,
      fontSize:
        16,
      fontWeight:
        '700',
      marginTop:
        4,
    },

    valueSmall: {
      color:
        colors.text,
      fontSize:
        13,
      fontWeight:
        '700',
      marginTop:
        4,
    },

    emptyTitle: {
      color:
        colors.text,
      fontSize:
        15,
      fontWeight:
        '800',
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
