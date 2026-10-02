import React, {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
  Image,
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
  getLocaleTag,
} from '../i18n/language';

import {
  getPropertyTenancy,
  PropertyTenancySummary,
  revokeTenantInvitation,
} from '../services/tenantRepository';

import {
  colors,
  radius,
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
    return '—';
  }

  const normalized =
    value.includes('T')
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

function DetailRow({
  label,
  value,
}: {
  label:
    string;

  value?:
    string;
}) {
  if (
    !value
  ) {
    return null;
  }

  return (
    <View
      style={
        styles.detailRow
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.value
        }
      >
        {value}
      </Text>
    </View>
  );
}

export function TenantDetailsScreen() {
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

  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const propertyId =
    route.params
      ?.propertyId as string;

  const [
    tenancy,
    setTenancy,
  ] =
    useState<
      PropertyTenancySummary | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    deletingInvitation,
    setDeletingInvitation,
  ] =
    useState(
      false,
    );

  const loadTenancy =
    useCallback(
      async () => {
        const result =
          await getPropertyTenancy(
            propertyId,
          );

        setTenancy(
          result,
        );
      },

      [
        propertyId,
      ],
    );

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
              const result =
                await getPropertyTenancy(
                  propertyId,
                );

              if (
                active
              ) {
                setTenancy(
                  result,
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
                    'tenantTitle',
                  ),

                  error instanceof
                  Error
                    ? error.message
                    : t(
                        'noActiveTenantForApartment',
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
        propertyId,
        t,
      ],
    ),
  );

  const deleteInvitation =
    () => {
      if (
        !tenancy?.invitation ||
        deletingInvitation
      ) {
        return;
      }

      Alert.alert(
        t(
          'deleteInvitationTitle',
        ),

        t(
          'deleteInvitationMessage',
        ),

        [
          {
            text:
              t(
                'cancel',
              ),

            style:
              'cancel',
          },

          {
            text:
              t(
                'delete',
              ),

            style:
              'destructive',

            onPress:
              async () => {
                setDeletingInvitation(
                  true,
                );

                try {
                  await revokeTenantInvitation(
                    tenancy.invitation!.id,
                  );

                  Alert.alert(
                    t(
                      'invitationDeleted',
                    ),

                    t(
                      'invitationDeletedMessage',
                    ),

                    [
                      {
                        text:
                          'OK',

                        onPress:
                          () => {
                            if (
                              typeof navigation.popTo ===
                              'function'
                            ) {
                              navigation.popTo(
                                'PropertyDetails',

                                {
                                  propertyId,
                                },
                              );

                              return;
                            }

                            navigation.navigate(
                              'PropertyDetails',

                              {
                                propertyId,
                              },
                            );
                          },
                      },
                    ],
                  );
                } catch (
                  error
                ) {
                  Alert.alert(
                    t(
                      'unableDeleteInvitation',
                    ),

                    error instanceof
                    Error
                      ? error.message
                      : t(
                          'unableDeleteInvitation',
                        ),
                  );

                  try {
                    await loadTenancy();
                  } catch {
                    // Reload failure is intentionally ignored here.
                  }
                } finally {
                  setDeletingInvitation(
                    false,
                  );
                }
              },
          },
        ],
      );
    };

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title={
            t(
              'tenantTitle',
            )
          }
          subtitle={
            t(
              'loadingTenantInformation',
            )
          }
        />
      </Screen>
    );
  }

  if (
    !tenancy
  ) {
    return (
      <Screen>
        <Header
          title={
            t(
              'tenantTitle',
            )
          }
          subtitle={
            t(
              'noActiveTenancy',
            )
          }
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            {t(
              'noActiveTenantForApartment',
            )}
          </Text>
        </Card>
      </Screen>
    );
  }

  const tenant =
    tenancy.tenant;

  const fullName =
    tenant
      ? `${tenant.firstName} ${tenant.lastName}`
      : t(
          'tenantInvitation',
        );

  const tenancyStatus =
    String(
      tenancy.status,
    );

  const checkoutPending =
    tenancyStatus ===
    'CHECKOUT_PENDING';

  const invitationPending =
    tenancyStatus ===
      'PENDING' &&
    tenancy.tenantType ===
      'INVITED' &&
    tenancy.invitation
      ?.status ===
      'PENDING';

  const canCheckout =
    tenancyStatus ===
      'ACTIVE' ||
    checkoutPending;

  return (
    <Screen>
      <Header
        title={
          fullName
        }
        subtitle={
          tenancy.tenantType ===
          'MANUAL'
            ? t(
                'manualTenant',
              )
            : tenancy.tenantType ===
                'DOMETRA'
              ? t(
                  'dometraTenant',
                )
              : t(
                  'invitationPending',
                )
        }
        right={
          <Badge
            text={
              checkoutPending
                ? t(
                    'checkoutRequired',
                  )
                : tenancyStatus ===
                    'ACTIVE'
                  ? t(
                      'active',
                    )
                  : t(
                      'pending',
                    )
            }
            tone={
              tenancyStatus ===
                'ACTIVE'
                ? 'success'
                : 'warning'
            }
          />
        }
      />

      {checkoutPending ? (
        <Card>
          <Text
            style={
              styles.importantTitle
            }
          >
            {t(
              'checkoutRequired',
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'checkoutRequiredDescription',
            )}
          </Text>
        </Card>
      ) : null}

      {invitationPending ? (
        <>
          <SectionTitle
            title={
              t(
                'invitation',
              )
            }
          />

          <Card>
            <View
              style={
                styles.invitationHeader
              }
            >
              <View
                style={
                  styles.flex
                }
              >
                <Text
                  style={
                    styles.importantTitle
                  }
                >
                  {t(
                    'waitingForTenant',
                  )}
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  {t(
                    'tenantHasNotAccepted',
                  )}
                </Text>
              </View>

              <Badge
                text={
                  t(
                    'pending',
                  )
                }
                tone="warning"
              />
            </View>

            {tenancy.invitation
              ?.expiresAt ? (
              <Text
                style={
                  styles.invitationExpiry
                }
              >
                {t(
                  'expires',

                  {
                    date:
                      new Date(
                        tenancy.invitation.expiresAt,
                      ).toLocaleString(
                        locale,
                      ),
                  },
                )}
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}

      {tenant ? (
        <>
          <SectionTitle
            title={
              t(
                'contact',
              )
            }
          />

          <Card>
            <DetailRow
              label={
                t(
                  'firstName',
                )
              }
              value={
                tenant.firstName
              }
            />

            <DetailRow
              label={
                t(
                  'lastName',
                )
              }
              value={
                tenant.lastName
              }
            />

            <DetailRow
              label={
                t(
                  'phone',
                )
              }
              value={
                tenant.phone
              }
            />

            <DetailRow
              label={
                t(
                  'email',
                )
              }
              value={
                tenant.email
              }
            />

            <DetailRow
              label={
                t(
                  'emergencyContact',
                )
              }
              value={
                tenant.emergencyContact
              }
            />
          </Card>

          {(
            tenant.passportIdNumber ||
            tenant.passportPhotoUri
          ) ? (
            <>
              <SectionTitle
                title={
                  t(
                    'identification',
                  )
                }
              />

              <Card>
                <DetailRow
                  label={
                    t(
                      'passportId',
                    )
                  }
                  value={
                    tenant.passportIdNumber
                  }
                />

                {tenant.passportPhotoUri ? (
                  <Image
                    source={{
                      uri:
                        tenant.passportPhotoUri,
                    }}
                    style={
                      styles.document
                    }
                    resizeMode="cover"
                  />
                ) : null}
              </Card>
            </>
          ) : null}

          {tenant.notes ? (
            <>
              <SectionTitle
                title={
                  t(
                    'notes',
                  )
                }
              />

              <Card>
                <Text
                  style={
                    styles.notes
                  }
                >
                  {
                    tenant.notes
                  }
                </Text>
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      <SectionTitle
        title={
          t(
            'rental',
          )
        }
      />

      <Card>
        <DetailRow
          label={
            t(
              'rent',
            )
          }
          value={
            t(
              'rentPerMonth',

              {
                amount:
                  tenancy.rentAmount,

                currency:
                  tenancy.currency,
              },
            )
          }
        />

        <DetailRow
          label={
            t(
              'started',
            )
          }
          value={
            formatDate(
              tenancy.startDate,
              locale,
            )
          }
        />

        <DetailRow
          label={
            t(
              'agreementEnds',
            )
          }
          value={
            tenancy.endDate
              ? formatDate(
                  tenancy.endDate,
                  locale,
                )
              : t(
                  'openEnded',
                )
          }
        />

        <DetailRow
          label={
            t(
              'paymentDue',
            )
          }
          value={
            t(
              'paymentDueDay',

              {
                day:
                  tenancy.paymentDueDay,
              },
            )
          }
        />

        <DetailRow
          label={
            t(
              'autoProlongation',
            )
          }
          value={
            tenancy.autoProlongation
              ? t(
                  'enabled',
                )
              : t(
                  'disabled',
                )
          }
        />

        {tenancy.depositAmount !==
        undefined ? (
          <DetailRow
            label={
              t(
                'securityDeposit',
              )
            }
            value={`${tenancy.depositAmount} ${
              tenancy.depositCurrency ??
              tenancy.currency
            }`}
          />
        ) : null}
      </Card>

      {tenancy.openingReadings.length >
      0 ? (
        <>
          <SectionTitle
            title={
              t(
                'openingMeterReadings',
              )
            }
          />

          <Card>
            {tenancy.openingReadings.map(
              reading => (
                <View
                  key={
                    reading.id
                  }
                  style={
                    styles.readingRow
                  }
                >
                  <View
                    style={
                      styles.flex
                    }
                  >
                    <Text
                      style={
                        styles.readingTitle
                      }
                    >
                      {
                        reading.meterName
                      }

                      {reading.registerCode
                        ? ` • ${reading.registerCode}`
                        : ''}
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      {t(
                        'moveIn',
                      )}
                      {' • '}
                      {formatDate(
                        reading.date,
                        locale,
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.readingValue
                    }
                  >
                    {
                      reading.value
                    }{' '}
                    {
                      reading.unit
                    }
                  </Text>
                </View>
              ),
            )}
          </Card>
        </>
      ) : null}

      {tenancy.agreementUri ? (
        <>
          <SectionTitle
            title={
              t(
                'agreement',
              )
            }
          />

          <Card>
            <Image
              source={{
                uri:
                  tenancy.agreementUri,
              }}
              style={
                styles.agreement
              }
              resizeMode="contain"
            />
          </Card>
        </>
      ) : null}

      {tenancy.tenantType ===
      'MANUAL' ? (
        <PrimaryButton
          title={
            t(
              'editTenant',
            )
          }
          onPress={() =>
            navigation.navigate(
              'TenantProfile',

              {
                mode:
                  'EDIT_MANUAL',

                propertyId,
              },
            )
          }
        />
      ) : null}

      {canCheckout ? (
        <PrimaryButton
          title={
            checkoutPending
              ? t(
                  'completeCheckout',
                )
              : t(
                  'endRental',
                )
          }
          onPress={() =>
            navigation.navigate(
              'CheckoutTenant',

              {
                propertyId,
              },
            )
          }
        />
      ) : null}

      {invitationPending ? (
        <View
          style={
            styles.deleteBlock
          }
        >
          <SecondaryButton
            title={
              deletingInvitation
                ? t(
                    'deletingInvitation',
                  )
                : t(
                    'deleteInvitation',
                  )
            }
            onPress={
              deleteInvitation
            }
          />

          <Text
            style={
              styles.deleteHint
            }
          >
            {t(
              'invitationDeleteHint',
            )}
          </Text>
        </View>
      ) : null}

      {tenancy.tenantType ===
      'DOMETRA' ? (
        <Text
          style={
            styles.footerHint
          }
        >
          {t(
            'personalProfileManagedByTenant',
          )}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex:
        1,
    },

    detailRow: {
      paddingVertical:
        8,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
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
        14,

      fontWeight:
        '600',

      marginTop:
        4,
    },

    document: {
      width:
        '100%',

      height:
        220,

      borderRadius:
        radius.sm,

      marginTop:
        spacing.md,

      backgroundColor:
        colors.border,
    },

    agreement: {
      width:
        '100%',

      height:
        360,

      borderRadius:
        radius.sm,
    },

    notes: {
      color:
        colors.text,

      fontSize:
        13,

      lineHeight:
        20,
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        3,
    },

    importantTitle: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    invitationHeader: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    invitationExpiry: {
      color:
        colors.muted,

      fontSize:
        11,

      marginTop:
        spacing.md,
    },

    readingRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      paddingVertical:
        9,
    },

    readingTitle: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '700',
    },

    readingValue: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    deleteBlock: {
      marginTop:
        spacing.md,
    },

    deleteHint: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      textAlign:
        'center',

      marginTop:
        8,
    },

    footerHint: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      textAlign:
        'center',

      marginTop:
        spacing.md,
    },
  });