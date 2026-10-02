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
  useRoute,
} from '@react-navigation/native';

import {
  Card,
  Field,
  Header,
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  recordPayment,
} from '../services/financeRepository';

import {
  getPropertyTenancy,
  PropertyTenancySummary,
} from '../services/tenantRepository';

import {
  CurrencyCode,
  PaymentMethod,
} from '../types';

import {
  colors,
  radius,
  spacing,
} from '../theme';

interface OccupiedProperty {
  propertyId: string;
  tenancy: PropertyTenancySummary;
}

function parseAmount(
  value: string,
) {
  return Number(
    value
      .trim()
      .replace(
        ',',
        '.',
      ),
  );
}

export function AddPaymentScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    state,
  } =
    useApp();

  const routePropertyId =
    route.params
      ?.propertyId as
      | string
      | undefined;

  const activeProperties =
    useMemo(
      () =>
        state.properties.filter(
          property =>
            property.status ===
            'ACTIVE',
        ),
      [
        state.properties,
      ],
    );

  const [
    occupiedProperties,
    setOccupiedProperties,
  ] =
    useState<
      OccupiedProperty[]
    >([]);

  const [
    loadingProperties,
    setLoadingProperties,
  ] =
    useState(true);

  const [
    propertyId,
    setPropertyId,
  ] =
    useState(
      routePropertyId ??
        '',
    );

  const [
    amount,
    setAmount,
  ] =
    useState('');

  const [
    currency,
    setCurrency,
  ] =
    useState<CurrencyCode>(
      'UAH',
    );

  const [
    method,
    setMethod,
  ] =
    useState<PaymentMethod>(
      'BANK_TRANSFER',
    );

  const [
    note,
    setNote,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  useFocusEffect(
    useCallback(
      () => {
        let active =
          true;

        const load =
          async () => {
            setLoadingProperties(
              true,
            );

            try {
              const rows =
                await Promise.all(
                  activeProperties.map(
                    async property => ({
                      property,

                      tenancy:
                        await getPropertyTenancy(
                          property.id,
                        ),
                    }),
                  ),
                );

              if (!active) {
                return;
              }

              const occupied =
                rows
                  .filter(
                    row =>
                      row.tenancy &&
                      (
                        row.tenancy.status ===
                          'ACTIVE' ||
                        row.tenancy.status ===
                          'CHECKOUT_PENDING'
                      ),
                  )
                  .map(
                    row => ({
                      propertyId:
                        row.property.id,

                      tenancy:
                        row.tenancy!,
                    }),
                  );

              setOccupiedProperties(
                occupied,
              );

              const preferred =
                routePropertyId &&
                occupied.some(
                  item =>
                    item.propertyId ===
                    routePropertyId,
                )
                  ? routePropertyId
                  : occupied[0]
                      ?.propertyId;

              if (preferred) {
                setPropertyId(
                  preferred,
                );

                const selected =
                  occupied.find(
                    item =>
                      item.propertyId ===
                      preferred,
                  );

                if (selected) {
                  setCurrency(
                    selected.tenancy.currency,
                  );
                }
              }
            } catch (error) {
              if (active) {
                Alert.alert(
                  'Payments',
                  error instanceof Error
                    ? error.message
                    : 'Unable to load rented apartments.',
                );
              }
            } finally {
              if (active) {
                setLoadingProperties(
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
        activeProperties,
        routePropertyId,
      ],
    ),
  );

  const selectProperty =
    (
      nextPropertyId:
        string,
    ) => {
      setPropertyId(
        nextPropertyId,
      );

      const selected =
        occupiedProperties.find(
          item =>
            item.propertyId ===
            nextPropertyId,
        );

      if (selected) {
        setCurrency(
          selected.tenancy.currency,
        );
      }
    };

  const numericAmount =
    parseAmount(
      amount,
    );

  const valid =
    Boolean(
      propertyId,
    ) &&
    Number.isFinite(
      numericAmount,
    ) &&
    numericAmount >
      0;

  const submit =
    async () => {
      if (
        !valid ||
        busy
      ) {
        return;
      }

      setBusy(
        true,
      );

      try {
        await recordPayment({
          propertyId,

          amount:
            numericAmount,

          currency,

          method,

          note:
            note.trim() ||
            undefined,
        });

        Alert.alert(
          'Payment saved',
          'The payment was saved and automatically applied to the oldest open debt. Any remaining amount is kept as advance.',
          [
            {
              text:
                'OK',

              onPress:
                () =>
                  navigation.goBack(),
            },
          ],
        );
      } catch (error) {
        Alert.alert(
          'Unable to save payment',
          error instanceof Error
            ? error.message
            : 'Unknown error.',
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  return (
    <Screen>
      <Header
        title="Add payment"
        subtitle="Record money received from a tenant"
      />

      <Text
        style={
          styles.label
        }
      >
        Apartment
      </Text>

      {loadingProperties ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading rented apartments...
          </Text>
        </Card>
      ) : null}

      {!loadingProperties &&
      occupiedProperties.length ===
        0 ? (
        <Card>
          <Text
            style={
              styles.emptyTitle
            }
          >
            No rented apartments
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            A payment can be recorded only for an active tenancy.
          </Text>
        </Card>
      ) : null}

      {!loadingProperties &&
      occupiedProperties.length >
        0 ? (
        <View
          style={
            styles.wrap
          }
        >
          {occupiedProperties.map(
            item => {
              const property =
                state.properties.find(
                  candidate =>
                    candidate.id ===
                    item.propertyId,
                );

              if (!property) {
                return null;
              }

              const selected =
                propertyId ===
                property.id;

              return (
                <Pressable
                  key={
                    property.id
                  }
                  onPress={() =>
                    selectProperty(
                      property.id,
                    )
                  }
                  disabled={
                    busy
                  }
                  style={[
                    styles.chip,

                    selected &&
                      styles.active,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,

                      selected &&
                        styles.activeText,
                    ]}
                  >
                    {property.name}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
      ) : null}

      <Field
        label="Amount"
        value={
          amount
        }
        onChangeText={
          setAmount
        }
        keyboardType="decimal-pad"
        placeholder="0"
        editable={
          !busy
        }
      />

      <Text
        style={
          styles.label
        }
      >
        Currency
      </Text>

      <View
        style={
          styles.wrap
        }
      >
        {(
          [
            'UAH',
            'USD',
            'EUR',
          ] as CurrencyCode[]
        ).map(
          item => (
            <Pressable
              key={
                item
              }
              onPress={() =>
                setCurrency(
                  item,
                )
              }
              disabled={
                busy
              }
              style={[
                styles.chip,

                currency ===
                  item &&
                  styles.active,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  currency ===
                    item &&
                    styles.activeText,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ),
        )}
      </View>

      <Text
        style={
          styles.label
        }
      >
        Payment method
      </Text>

      <View
        style={
          styles.wrap
        }
      >
        {(
          [
            'BANK_TRANSFER',
            'CASH',
            'CARD',
            'OTHER',
          ] as PaymentMethod[]
        ).map(
          item => (
            <Pressable
              key={
                item
              }
              onPress={() =>
                setMethod(
                  item,
                )
              }
              disabled={
                busy
              }
              style={[
                styles.chip,

                method ===
                  item &&
                  styles.active,
              ]}
            >
              <Text
                style={[
                  styles.chipText,

                  method ===
                    item &&
                    styles.activeText,
                ]}
              >
                {item.replace(
                  /_/g,
                  ' ',
                )}
              </Text>
            </Pressable>
          ),
        )}
      </View>

      <Field
        label="Note (optional)"
        value={
          note
        }
        onChangeText={
          setNote
        }
        placeholder="September rent"
        editable={
          !busy
        }
      />

      <PrimaryButton
        title={
          busy
            ? 'Saving...'
            : 'Save payment'
        }
        onPress={() =>
          void submit()
        }
        disabled={
          !valid ||
          busy ||
          loadingProperties
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    label: {
      color:
        colors.text,
      fontWeight:
        '700',
      fontSize:
        13,
    },

    wrap: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        spacing.sm,
    },

    chip: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      paddingHorizontal:
        12,
      paddingVertical:
        10,
      borderRadius:
        radius.sm,
    },

    active: {
      borderColor:
        colors.primary,
      backgroundColor:
        colors.primarySoft,
    },

    chipText: {
      color:
        colors.text,
      fontWeight:
        '700',
      fontSize:
        12,
    },

    activeText: {
      color:
        colors.primary,
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
  });