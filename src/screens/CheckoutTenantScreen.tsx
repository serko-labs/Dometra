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
  useTranslation,
} from 'react-i18next';

import {
  Badge,
  Card,
  Field,
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '../components/ui';

import {
  cancelTenancyCheckout,
  CheckoutReading,
  CheckoutRequiredRegister,
  completeTenancyCheckout,
  DepositSettlementAction,
  loadCheckoutReadings,
  loadCheckoutRequiredRegisters,
  loadTenancyCheckout,
  startTenancyCheckout,
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

function todayLocal() {
  const now =
    new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}-${String(
    now.getDate(),
  ).padStart(
    2,
    '0',
  )}`;
}

function isDate(
  value:
    string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00`,
    );

  return !Number.isNaN(
    date.getTime(),
  );
}

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

function money(
  value:
    number | undefined,

  currency:
    string | undefined,
) {
  if (
    value === undefined
  ) {
    return '—';
  }

  return `${value.toLocaleString(
    undefined,

    {
      maximumFractionDigits:
        2,
    },
  )} ${currency ?? ''}`.trim();
}

const depositOptions:
  Array<{
    value:
      DepositSettlementAction;

    label:
      string;
  }> = [
    {
      value:
        'RETURNED',

      label:
        'Return full',
    },

    {
      value:
        'PARTIALLY_RETURNED',

      label:
        'Return part',
    },

    {
      value:
        'APPLIED',

      label:
        'Keep / apply',
    },

    {
      value:
        'WAIVED',

      label:
        'Waive',
    },
  ];

export function CheckoutTenantScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    t,
  } =
    useTranslation();

  const propertyId =
    route.params
      ?.propertyId as string;

  const tenancyIdFromRoute =
    route.params
      ?.tenancyId as
      | string
      | undefined;

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
    registers,
    setRegisters,
  ] =
    useState<
      CheckoutRequiredRegister[]
    >([]);

  const [
    readings,
    setReadings,
  ] =
    useState<
      CheckoutReading[]
    >([]);

  const [
    checkoutDate,
    setCheckoutDate,
  ] =
    useState(
      todayLocal(),
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      '',
    );

  const [
    depositAction,
    setDepositAction,
  ] =
    useState<
      DepositSettlementAction
    >(
      'RETURNED',
    );

  const [
    partialReturn,
    setPartialReturn,
  ] =
    useState(
      '',
    );

  const [
    settlementNotes,
    setSettlementNotes,
  ] =
    useState(
      '',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const reload =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const currentTenancy =
            await getPropertyTenancy(
              propertyId,
            );

          const tenancyId =
            tenancyIdFromRoute ??
            currentTenancy?.id;

          if (
            !currentTenancy ||
            !tenancyId
          ) {
            setTenancy(
              null,
            );

            setCheckout(
              null,
            );

            setRegisters(
              [],
            );

            setReadings(
              [],
            );

            return;
          }

          const [
            checkoutData,
            requiredRegisters,
            checkoutReadings,
          ] =
            await Promise.all([
              loadTenancyCheckout(
                tenancyId,
              ),

              loadCheckoutRequiredRegisters(
                tenancyId,
              ),

              loadCheckoutReadings(
                tenancyId,
              ),
            ]);

          setTenancy(
            currentTenancy,
          );

          setCheckout(
            checkoutData,
          );

          setRegisters(
            requiredRegisters,
          );

          setReadings(
            checkoutReadings,
          );

          if (
            checkoutData
          ) {
            setCheckoutDate(
              checkoutData.checkoutDate,
            );

            setNotes(
              checkoutData.notes ??
              '',
            );

            if (
              checkoutData.depositAction
            ) {
              setDepositAction(
                checkoutData.depositAction,
              );
            }

            if (
              checkoutData.depositReturnAmount !==
              undefined
            ) {
              setPartialReturn(
                String(
                  checkoutData.depositReturnAmount,
                ),
              );
            }

            setSettlementNotes(
              checkoutData.settlementNotes ??
              '',
            );
          }
        } catch (
          error
        ) {
          Alert.alert(
            t(
              'checkout',

              {
                defaultValue:
                  'Checkout',
              },
            ),

            error instanceof
            Error
              ? error.message
              : 'Unable to load checkout.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        propertyId,
        tenancyIdFromRoute,
        t,
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

  const submittedIds =
    useMemo(
      () =>
        new Set(
          readings.map(
            item =>
              item.meterRegisterId,
          ),
        ),

      [
        readings,
      ],
    );

  const submittedCount =
    registers.filter(
      item =>
        submittedIds.has(
          item.id,
        ),
    ).length;

  const readingsComplete =
    submittedCount ===
    registers.length;

  const depositAmount =
    tenancy?.depositAmount;

  const depositCurrency =
    tenancy?.depositCurrency ??
    tenancy?.currency;

  const hasDeposit =
    Boolean(
      depositAmount &&
      depositAmount >
        0,
    );

  const startCheckout =
    async () => {
      if (
        !tenancy ||
        busy
      ) {
        return;
      }

      if (
        !isDate(
          checkoutDate,
        )
      ) {
        Alert.alert(
          'Checkout',
          'Enter a valid date in YYYY-MM-DD format.',
        );

        return;
      }

      if (
        checkoutDate <
        tenancy.startDate
      ) {
        Alert.alert(
          'Checkout',
          'Checkout date cannot be before the tenancy start date.',
        );

        return;
      }

      setBusy(
        true,
      );

      try {
        await startTenancyCheckout(
          {
            tenancyId:
              tenancy.id,

            checkoutDate,

            notes,
          },
        );

        await reload();

        Alert.alert(
          'Checkout started',
          'The tenant can now submit final meter readings. Regular monthly readings should no longer be used for this move-out.',
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to start checkout',

          error instanceof
          Error
            ? error.message
            : 'Unknown error.',
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  const cancelCheckout =
    () => {
      if (
        !tenancy ||
        busy
      ) {
        return;
      }

      Alert.alert(
        'Cancel checkout?',
        'Final checkout readings will be removed and the tenancy will remain active.',

        [
          {
            text:
              'Keep checkout',

            style:
              'cancel',
          },

          {
            text:
              'Cancel checkout',

            style:
              'destructive',

            onPress:
              async () => {
                if (
                  busy
                ) {
                  return;
                }

                setBusy(
                  true,
                );

                try {
                  await cancelTenancyCheckout(
                    tenancy.id,
                  );

                  await reload();
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Unable to cancel checkout',

                    error instanceof
                    Error
                      ? error.message
                      : 'Unknown error.',
                  );
                } finally {
                  setBusy(
                    false,
                  );
                }
              },
          },
        ],
      );
    };

  const finishCheckout =
    async () => {
      if (
        !tenancy ||
        !checkout ||
        busy
      ) {
        return;
      }

      if (
        !readingsComplete
      ) {
        Alert.alert(
          'Final readings required',
          'Submit all final meter readings first.',
        );

        return;
      }

      let returnAmount:
        number | undefined;

      if (
        hasDeposit &&
        depositAction ===
          'RETURNED'
      ) {
        returnAmount =
          depositAmount;
      } else if (
        hasDeposit &&
        depositAction ===
          'PARTIALLY_RETURNED'
      ) {
        const parsed =
          Number(
            partialReturn.replace(
              ',',
              '.',
            ),
          );

        if (
          !Number.isFinite(
            parsed,
          ) ||
          parsed <=
            0 ||
          parsed >=
            (
              depositAmount ??
              0
            )
        ) {
          Alert.alert(
            'Deposit',

            `Enter an amount greater than 0 and less than ${money(
              depositAmount,
              depositCurrency,
            )}.`,
          );

          return;
        }

        returnAmount =
          parsed;
      } else if (
        hasDeposit
      ) {
        returnAmount =
          0;
      }

      Alert.alert(
        'Complete checkout?',

        `This will end the tenancy on ${formatDate(
          checkout.checkoutDate,
        )} and make the apartment vacant.`,

        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Complete',

            style:
              'destructive',

            onPress:
              async () => {
                if (
                  busy
                ) {
                  return;
                }

                setBusy(
                  true,
                );

                try {
                  await completeTenancyCheckout(
                    {
                      tenancyId:
                        tenancy.id,

                      depositAction:
                        hasDeposit
                          ? depositAction
                          : undefined,

                      depositReturnAmount:
                        returnAmount,

                      settlementNotes,
                    },
                  );

                  Alert.alert(
                    'Checkout completed',
                    'The tenancy is ended and the apartment is now vacant.',

                    [
                      {
                        text:
                          'OK',

                        onPress:
                          () => {
                            if (
                              navigation.canGoBack()
                            ) {
                              navigation.goBack();
                            }
                          },
                      },
                    ],
                  );
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Unable to complete checkout',

                    error instanceof
                    Error
                      ? error.message
                      : 'Unknown error.',
                  );
                } finally {
                  setBusy(
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
          title="Tenant checkout"
          subtitle="Loading checkout..."
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading...
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
          title="Tenant checkout"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            No active tenancy
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            This apartment does not currently have an active tenant.
          </Text>
        </Card>
      </Screen>
    );
  }

  const tenantName =
    tenancy.tenant
      ? `${tenancy.tenant.firstName} ${tenancy.tenant.lastName}`
      : 'Tenant';

  return (
    <Screen>
      <Header
        title="Tenant checkout"
        subtitle={
          tenantName
        }
      />

      {!checkout ||
      checkout.status ===
        'CANCELLED' ? (
        <>
          <Card>
            <Text
              style={
                styles.title
              }
            >
              End this tenancy
            </Text>

            <Text
              style={
                styles.muted
              }
            >
              Start checkout first. The tenancy remains active until final readings and the deposit settlement are reviewed.
            </Text>
          </Card>

          <Field
            label="Checkout date *"
            value={
              checkoutDate
            }
            onChangeText={
              setCheckoutDate
            }
            placeholder="YYYY-MM-DD"
            editable={
              !busy
            }
          />

          <Field
            label="Notes"
            value={
              notes
            }
            onChangeText={
              setNotes
            }
            placeholder="Optional move-out notes"
            editable={
              !busy
            }
            multiline
          />

          <PrimaryButton
            title={
              busy
                ? 'Starting...'
                : 'Start checkout'
            }
            disabled={
              busy
            }
            onPress={() =>
              void startCheckout()
            }
          />
        </>
      ) : null}

      {checkout?.status ===
      'PENDING' ? (
        <>
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
                    styles.title
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
                </Text>
              </View>

              <Badge
                text="Pending"
                tone="warning"
              />
            </View>
          </Card>

          <SectionTitle
            title="Final meter readings"
          />

          <Card>
            <View
              style={
                styles.rowBetween
              }
            >
              <Text
                style={
                  styles.title
                }
              >
                Progress
              </Text>

              <Badge
                text={`${submittedCount}/${registers.length}`}
                tone={
                  readingsComplete
                    ? 'success'
                    : 'warning'
                }
              />
            </View>

            {registers.length ===
            0 ? (
              <Text
                style={
                  styles.muted
                }
              >
                No metered services require final readings.
              </Text>
            ) : null}

            {registers.map(
              register => {
                const reading =
                  readings.find(
                    item =>
                      item.meterRegisterId ===
                      register.id,
                  );

                const registerCount =
                  registers.filter(
                    item =>
                      item.meterId ===
                      register.meterId,
                  ).length;

                return (
                  <View
                    key={
                      register.id
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
                          register.meterName
                        }

                        {registerCount >
                        1
                          ? ` · ${register.code}`
                          : ''}
                      </Text>

                      <Text
                        style={
                          styles.muted
                        }
                      >
                        Previous:{' '}

                        {register.lastValue !==
                        undefined
                          ? `${register.lastValue} ${register.unit}`
                          : '—'}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.readingValue
                      }
                    >
                      {reading
                        ? `${reading.value} ${register.unit}`
                        : 'Not submitted'}
                    </Text>
                  </View>
                );
              },
            )}
          </Card>

          {hasDeposit ? (
            <>
              <SectionTitle
                title="Security deposit"
              />

              <Card>
                <Text
                  style={
                    styles.depositAmount
                  }
                >
                  {money(
                    depositAmount,
                    depositCurrency,
                  )}
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  Choose how the deposit is settled before completing checkout.
                </Text>

                <View
                  style={
                    styles.chips
                  }
                >
                  {depositOptions.map(
                    option => (
                      <Pressable
                        key={
                          option.value
                        }
                        disabled={
                          busy
                        }
                        onPress={() =>
                          setDepositAction(
                            option.value,
                          )
                        }
                        style={[
                          styles.chip,

                          depositAction ===
                            option.value &&
                            styles.chipActive,

                          busy &&
                            styles.disabledChip,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,

                            depositAction ===
                              option.value &&
                              styles.chipTextActive,
                          ]}
                        >
                          {
                            option.label
                          }
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>

                {depositAction ===
                'PARTIALLY_RETURNED' ? (
                  <Field
                    label={`Amount returned (${depositCurrency ?? ''})`}
                    value={
                      partialReturn
                    }
                    onChangeText={
                      setPartialReturn
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                    editable={
                      !busy
                    }
                  />
                ) : null}

                <Field
                  label="Settlement notes"
                  value={
                    settlementNotes
                  }
                  onChangeText={
                    setSettlementNotes
                  }
                  placeholder="Optional note"
                  editable={
                    !busy
                  }
                  multiline
                />
              </Card>
            </>
          ) : null}

          <PrimaryButton
            title={
              busy
                ? 'Completing...'
                : 'Complete checkout'
            }
            disabled={
              busy ||
              !readingsComplete
            }
            onPress={() =>
              void finishCheckout()
            }
          />

          <View
            style={
              styles.buttonTop
            }
          >
            <SecondaryButton
              title={
                busy
                  ? 'Please wait...'
                  : 'Cancel checkout'
              }
              onPress={
                cancelCheckout
              }
            />
          </View>
        </>
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

    title: {
      color:
        colors.text,

      fontSize:
        16,

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
        12,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.border,
    },

    readingName: {
      color:
        colors.text,

      fontSize:
        14,

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

      textAlign:
        'right',
    },

    depositAmount: {
      color:
        colors.text,

      fontSize:
        22,

      fontWeight:
        '900',
    },

    chips: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        8,

      marginVertical:
        spacing.md,
    },

    chip: {
      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        radius.sm,

      paddingHorizontal:
        12,

      paddingVertical:
        9,
    },

    chipActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        `${colors.primary}12`,
    },

    disabledChip: {
      opacity:
        0.5,
    },

    chipText: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    chipTextActive: {
      color:
        colors.primary,
    },

    buttonTop: {
      marginTop:
        spacing.sm,
    },
  });