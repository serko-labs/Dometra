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
  SectionTitle,
} from '../components/ui';

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
  value?: string,
) {
  if (!value) {
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
  label: string;
  value?: string;
}) {
  if (!value) {
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
                  'Tenant',
                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load tenant.',
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
          subtitle="Loading tenant information..."
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
          title="Tenant"
          subtitle="No active tenancy"
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            There is no active tenant for this apartment.
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
      : 'Tenant invitation';

  const tenancyStatus =
    String(
      tenancy.status,
    );

  const checkoutPending =
    tenancyStatus ===
    'CHECKOUT_PENDING';

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
            ? 'Manual tenant'
            : tenancy.tenantType ===
                'DOMETRA'
              ? 'Dometra tenant'
              : 'Invitation pending'
        }
        right={
          <Badge
            text={
              checkoutPending
                ? 'Checkout required'
                : tenancyStatus ===
                    'ACTIVE'
                  ? 'Active'
                  : 'Pending'
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
              styles.checkoutTitle
            }
          >
            Checkout required
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            The rental agreement has reached its end date. Complete checkout to close the rental.
          </Text>
        </Card>
      ) : null}

      {tenant ? (
        <>
          <SectionTitle
            title="Contact"
          />

          <Card>
            <DetailRow
              label="First name"
              value={
                tenant.firstName
              }
            />

            <DetailRow
              label="Last name"
              value={
                tenant.lastName
              }
            />

            <DetailRow
              label="Phone"
              value={
                tenant.phone
              }
            />

            <DetailRow
              label="Email"
              value={
                tenant.email
              }
            />

            <DetailRow
              label="Emergency contact"
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
                title="Identification"
              />

              <Card>
                <DetailRow
                  label="Passport / ID"
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
                title="Notes"
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
        title="Rental"
      />

      <Card>
        <DetailRow
          label="Rent"
          value={`${tenancy.rentAmount} ${tenancy.currency} / month`}
        />

        <DetailRow
          label="Started"
          value={
            formatDate(
              tenancy.startDate,
            )
          }
        />

        <DetailRow
          label="Agreement ends"
          value={
            tenancy.endDate
              ? formatDate(
                  tenancy.endDate,
                )
              : 'Open-ended'
          }
        />

        <DetailRow
          label="Payment due"
          value={`Day ${tenancy.paymentDueDay} of each month`}
        />

        <DetailRow
          label="Auto-prolongation"
          value={
            tenancy.autoProlongation
              ? 'Enabled'
              : 'Disabled'
          }
        />

        {tenancy.depositAmount !==
        undefined ? (
          <DetailRow
            label="Security deposit"
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
            title="Opening meter readings"
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
                      Move-in •{' '}
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

      {canCheckout ? (
        <PrimaryButton
          title={
            checkoutPending
              ? 'Complete checkout'
              : 'End rental'
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
      flex: 1,
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

    checkoutTitle: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
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

    footerHint: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      textAlign:
        'center',
    },
  });