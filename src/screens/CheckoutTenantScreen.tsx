import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
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
  CheckoutContext,
  CheckoutReadingInput,
  checkoutTenancy,
  getCheckoutContext,
} from '../services/checkoutRepository';

import {
  colors,
  radius,
  spacing,
} from '../theme';

function todayLocalDate(): string {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function isValidIsoDate(
  value: string,
): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return false;
  }

  const year =
    Number(
      match[1],
    );

  const month =
    Number(
      match[2],
    );

  const day =
    Number(
      match[3],
    );

  const date =
    new Date(
      year,
      month - 1,
      day,
    );

  return (
    date.getFullYear() ===
      year &&
    date.getMonth() ===
      month - 1 &&
    date.getDate() ===
      day
  );
}

export function CheckoutTenantScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const propertyId =
    route.params
      ?.propertyId as string;

  const [
    context,
    setContext,
  ] =
    useState<
      CheckoutContext | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    checkoutDate,
    setCheckoutDate,
  ] =
    useState(
      todayLocalDate(),
    );

  const [
    notes,
    setNotes,
  ] =
    useState('');

  const [
    readingValues,
    setReadingValues,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

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
                await getCheckoutContext(
                  propertyId,
                );

              if (
                !active
              ) {
                return;
              }

              setContext(
                result,
              );

              // Important:
              // every checkout starts
              // with blank final readings.
              setReadingValues(
                {},
              );
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  'End rental',
                  error instanceof
                  Error
                    ? error.message
                    : 'Unable to load checkout.',
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

  const enteredReadingCount =
    useMemo(
      () =>
        Object.values(
          readingValues,
        ).filter(
          value =>
            value.trim()
              .length > 0,
        ).length,
      [
        readingValues,
      ],
    );

  function buildReadings():
    CheckoutReadingInput[] {
    if (!context) {
      return [];
    }

    const result:
      CheckoutReadingInput[] =
      [];

    for (
      const register
      of context.registers
    ) {
      const raw =
        readingValues[
          register.id
        ]?.trim();

      if (!raw) {
        continue;
      }

      const normalized =
        raw.replace(
          ',',
          '.',
        );

      const value =
        Number(
          normalized,
        );

      if (
        !Number.isFinite(
          value,
        ) ||
        value < 0
      ) {
        throw new Error(
          `Invalid final reading for ${register.meterName} ${register.registerCode}.`,
        );
      }

      result.push({
        meterRegisterId:
          register.id,

        value,
      });
    }

    return result;
  }

  async function performCheckout() {
    if (
      !context ||
      saving
    ) {
      return;
    }

    setSaving(
      true,
    );

    try {
      const readings =
        buildReadings();

      await checkoutTenancy({
        tenancyId:
          context.tenancyId,

        checkoutDate:
          checkoutDate.trim(),

        notes,

        readings,
      });

      Alert.alert(
        'Rental ended',
        'The tenant checkout is complete. The apartment is now available.',
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
        'Unable to end rental',
        error instanceof
        Error
          ? error.message
          : 'Please try again.',
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  function submit() {
    if (
      !context ||
      saving
    ) {
      return;
    }

    const date =
      checkoutDate.trim();

    if (
      !isValidIsoDate(
        date,
      )
    ) {
      Alert.alert(
        'Checkout date',
        'Enter a valid date in YYYY-MM-DD format.',
      );

      return;
    }

    if (
      date <
      context.startDate
    ) {
      Alert.alert(
        'Checkout date',
        'Checkout date cannot be before the rental start date.',
      );

      return;
    }

    if (
      date >
      todayLocalDate()
    ) {
      Alert.alert(
        'Checkout date',
        'Checkout date cannot be in the future.',
      );

      return;
    }

    try {
      buildReadings();
    } catch (
      error
    ) {
      Alert.alert(
        'Meter readings',
        error instanceof
        Error
          ? error.message
          : 'Check the final meter readings.',
      );

      return;
    }

    Alert.alert(
      'End this rental?',
      'This will finish the tenancy and make the apartment available. Tenant history, payments, invoices and meter history will be preserved.',
      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },
        {
          text:
            'End rental',

          style:
            'destructive',

          onPress:
            () =>
              void performCheckout(),
        },
      ],
    );
  }

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title="End rental"
          subtitle="Loading checkout..."
        />
      </Screen>
    );
  }

  if (
    !context
  ) {
    return (
      <Screen>
        <Header
          title="End rental"
          subtitle="No active rental"
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            There is no active or checkout-pending rental for this apartment.
          </Text>
        </Card>
      </Screen>
    );
  }

  const checkoutRequired =
    context.status ===
    'CHECKOUT_PENDING';

  return (
    <Screen>
      <Header
        title="End rental"
        subtitle={
          context.propertyTitle
        }
        right={
          <Badge
            text={
              checkoutRequired
                ? 'Checkout required'
                : 'Active'
            }
            tone={
              checkoutRequired
                ? 'warning'
                : 'success'
            }
          />
        }
      />

      {checkoutRequired ? (
        <Card>
          <Text
            style={
              styles.warningTitle
            }
          >
            Rental term has ended
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Complete checkout to close the tenancy and make the apartment available.
          </Text>
        </Card>
      ) : null}

      <SectionTitle
        title="Checkout"
      />

      <Card>
        <Text
          style={
            styles.label
          }
        >
          Checkout date *
        </Text>

        <TextInput
          value={
            checkoutDate
          }
          onChangeText={
            setCheckoutDate
          }
          placeholder="YYYY-MM-DD"
          placeholderTextColor={
            colors.muted
          }
          autoCapitalize="none"
          autoCorrect={
            false
          }
          style={
            styles.input
          }
        />

        <Text
          style={
            styles.helper
          }
        >
          Rental started{' '}
          {context.startDate}

          {context.endDate
            ? ` • Agreement ends ${context.endDate}`
            : ''}
        </Text>
      </Card>

      <SectionTitle
        title="Final meter readings"
      />

      <Card>
        {context.registers.length ===
        0 ? (
          <Text
            style={
              styles.muted
            }
          >
            No active meters are configured for this apartment.
          </Text>
        ) : (
          <>
            <Text
              style={
                styles.muted
              }
            >
              Optional. Leave a field blank if you do not want to save a move-out reading.
            </Text>

            {context.registers.map(
              register => (
                <View
                  key={
                    register.id
                  }
                  style={
                    styles.readingBlock
                  }
                >
                  <View
                    style={
                      styles.readingHeader
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
                          register.meterName
                        }
                      </Text>

                      <Text
                        style={
                          styles.helper
                        }
                      >
                        {
                          register.registerCode
                        }

                        {register.registerName
                          ? ` • ${register.registerName}`
                          : ''}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.unit
                      }
                    >
                      {
                        register.unit
                      }
                    </Text>
                  </View>

                  <TextInput
                    value={
                      readingValues[
                        register.id
                      ] ??
                      ''
                    }
                    onChangeText={
                      value =>
                        setReadingValues(
                          current => ({
                            ...current,

                            [register.id]:
                              value,
                          }),
                        )
                    }
                    placeholder="Final reading"
                    placeholderTextColor={
                      colors.muted
                    }
                    keyboardType="decimal-pad"
                    style={
                      styles.input
                    }
                  />
                </View>
              ),
            )}
          </>
        )}
      </Card>

      <SectionTitle
        title="Notes"
      />

      <Card>
        <TextInput
          value={
            notes
          }
          onChangeText={
            setNotes
          }
          placeholder="Optional checkout notes"
          placeholderTextColor={
            colors.muted
          }
          multiline
          style={[
            styles.input,
            styles.notesInput,
          ]}
        />
      </Card>

      <Card>
        <Text
          style={
            styles.summaryTitle
          }
        >
          What happens next
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          The tenancy will be marked as ended, the apartment will become available, and all existing tenant history will remain in Dometra.
        </Text>

        <Text
          style={
            styles.helper
          }
        >
          Final readings entered:{' '}
          {enteredReadingCount}
        </Text>
      </Card>

      <PrimaryButton
        title={
          saving
            ? 'Ending rental...'
            : 'End rental'
        }
        onPress={
          submit
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
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

      marginBottom:
        7,
    },

    input: {
      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        radius.sm,

      paddingHorizontal:
        12,

      paddingVertical:
        11,

      color:
        colors.text,

      fontSize:
        14,
    },

    notesInput: {
      minHeight:
        100,

      textAlignVertical:
        'top',
    },

    helper: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        7,
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,
    },

    warningTitle: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',

      marginBottom:
        5,
    },

    readingBlock: {
      paddingTop:
        spacing.md,

      marginTop:
        spacing.md,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,
    },

    readingHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      marginBottom:
        8,
    },

    readingTitle: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    unit: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    summaryTitle: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',

      marginBottom:
        5,
    },
  });