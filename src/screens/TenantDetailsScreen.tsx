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
  Badge,
  Card,
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  loadTenancyCheckout,
  TenancyCheckout,
} from '../services/checkoutRepository';

import {
  getPropertyTenancy,
  PropertyTenancySummary,
} from '../services/tenantRepository';

import {
  colors,
  radius,
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
    checkout,
    setCheckout,
  ] =
    useState<
      TenancyCheckout | null
    >(null);

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
          const data =
            await getPropertyTenancy(
              propertyId,
            );

          const checkoutData =
            data
              ? await loadTenancyCheckout(
                  data.id,
                )
              : null;

          setTenancy(
            data,
          );

          setCheckout(
            checkoutData,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Tenant',

            error instanceof
            Error
              ? error.message
              : 'Unable to load tenant.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        propertyId,
      ],
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

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title="Tenant"
          subtitle="Loading tenant..."
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading tenant...
          </Text>
        </Card>
      </Screen>
    );
  }

  if (
    !tenancy
  ) {
    return (
      <Screen>
        <Header
          title="Tenant"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            No active tenant
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            This apartment does not currently have an active tenancy.
          </Text>
        </Card>
      </Screen>
    );
  }

  const tenantName =
    tenancy.tenant
      ? `${tenancy.tenant.firstName} ${tenancy.tenant.lastName}`
      : tenancy.tenantType ===
          'INVITED'
        ? 'Invited tenant'
        : 'Tenant';

  const checkoutPending =
    checkout?.status ===
    'PENDING';

  return (
    <Screen>
      <Header
        title={
          tenantName
        }
        subtitle={
          tenancy.tenantType ===
          'MANUAL'
            ? 'Manual tenant'
            : 'Dometra tenant'
        }
        right={
          <Badge
            text={
              checkoutPending
                ? 'Checkout'
                : tenancy.status ===
                    'PENDING'
                  ? 'Pending'
                  : 'Active'
            }
            tone={
              checkoutPending ||
              tenancy.status ===
                'PENDING'
                ? 'warning'
                : 'success'
            }
          />
        }
      />

      {checkoutPending ? (
        <Card>
          <Text
            style={
              styles.checkoutTitle
            }
          >
            Checkout in progress
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Move-out date:{' '}
            {formatDate(
              checkout.checkoutDate,
            )}
            . Waiting for final readings and landlord confirmation.
          </Text>

          <View
            style={
              styles.buttonTop
            }
          >
            <PrimaryButton
              title="Continue checkout"
              onPress={() =>
                navigation.navigate(
                  'CheckoutTenant',

                  {
                    propertyId,

                    tenancyId:
                      tenancy.id,
                  },
                )
              }
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle
        title="Profile"
      />

      <Card>
        {tenancy.tenant ? (
          <>
            <DetailRow
              label="First name"
              value={
                tenancy.tenant.firstName
              }
            />

            <DetailRow
              label="Last name"
              value={
                tenancy.tenant.lastName
              }
            />

            <DetailRow
              label="Phone"
              value={
                tenancy.tenant.phone
              }
            />

            <DetailRow
              label="Email"
              value={
                tenancy.tenant.email
              }
            />

            <DetailRow
              label="Passport / ID"
              value={
                tenancy.tenant.passportIdNumber
              }
            />

            <DetailRow
              label="Emergency contact"
              value={
                tenancy.tenant.emergencyContact
              }
            />

            <DetailRow
              label="Notes"
              value={
                tenancy.tenant.notes
              }
            />

            {tenancy.tenant.passportPhotoUri ? (
              <Image
                source={{
                  uri:
                    tenancy.tenant.passportPhotoUri,
                }}
                style={
                  styles.document
                }
                resizeMode="contain"
              />
            ) : null}
          </>
        ) : (
          <Text
            style={
              styles.muted
            }
          >
            The tenant has not accepted the invitation yet.
          </Text>
        )}
      </Card>

      <SectionTitle
        title="Tenancy"
      />

      <Card>
        <DetailRow
          label="Start date"
          value={formatDate(
            tenancy.startDate,
          )}
        />

        <DetailRow
          label="End date"
          value={
            checkoutPending
              ? formatDate(
                  checkout.checkoutDate,
                )
              : tenancy.endDate
                ? formatDate(
                    tenancy.endDate,
                  )
                : 'Open-ended'
          }
        />

        <DetailRow
          label="Rent"
          value={`${tenancy.rentAmount} ${tenancy.currency}`}
        />

        <DetailRow
          label="Payment due day"
          value={String(
            tenancy.paymentDueDay,
          )}
        />

        <DetailRow
          label="Deposit"
          value={
            tenancy.depositAmount !==
            undefined
              ? `${tenancy.depositAmount} ${
                  tenancy.depositCurrency ??
                  tenancy.currency
                }`
              : '—'
          }
        />

        <DetailRow
          label="Auto-prolongation"
          value={
            tenancy.autoProlongation
              ? 'Enabled'
              : 'Disabled'
          }
        />
      </Card>

      {tenancy.openingReadings.length >
      0 ? (
        <>
          <SectionTitle
            title="Move-in readings"
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
                        styles.readingName
                      }
                    >
                      {
                        reading.meterName
                      }

                      {reading.registerCode
                        ? ` · ${reading.registerCode}`
                        : ''}
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      Move-in ·{' '}
                      {formatDate(
                        reading.date,
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
            title="Agreement"
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
          title="Edit tenant"
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

      {tenancy.status ===
        'ACTIVE' &&
      !checkoutPending ? (
        <View
          style={
            styles.buttonTop
          }
        >
          <SecondaryButton
            title="Checkout tenant"
            onPress={() =>
              navigation.navigate(
                'CheckoutTenant',

                {
                  propertyId,

                  tenancyId:
                    tenancy.id,
                },
              )
            }
          />
        </View>
      ) : null}

      {tenancy.tenantType ===
      'DOMETRA' ? (
        <Text
          style={
            styles.footerHint
          }
        >
          Personal profile information is managed by the tenant in their Dometra account.
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

    title: {
      color:
        colors.text,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    checkoutTitle: {
      color:
        '#92400E',

      fontSize:
        16,

      fontWeight:
        '800',
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
        10,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    readingName: {
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
        13,

      fontWeight:
        '800',
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    buttonTop: {
      marginTop:
        spacing.md,
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

      marginBottom:
        spacing.md,
    },
  });