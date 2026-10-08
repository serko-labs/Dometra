import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker
  from 'expo-image-picker';

import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

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
  PaymentStatusBadge,
} from '../components/PaymentStatusBadge';

import {
  attachTenantPaymentProof,
  billingErrorMessage,
  billingMonthLabel,
  BillingPreviewLine,
  confirmTenantPayment,
  currentBillingPeriod,
  getTenantPaymentState,
  loadTenantBillingSummary,
  paymentDueDate,
  rejectTenantPayment,
  removeTenantPaymentProof,
  TenantBillingSummary,
} from '../services/billingRepository';

import {
  colors,
  radius,
  spacing,
} from '../theme';

function formatMoney(
  value:
    number,

  currency:
    string,
) {
  return `${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        2,
    },
  )} ${currency}`;
}

function formatDate(
  value:
    Date | null,
) {
  if (
    !value
  ) {
    return '—';
  }

  return value.toLocaleDateString(
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

function lineLabel(
  kind:
    BillingPreviewLine['kind'],
) {
  switch (
    kind
  ) {
    case 'RENT':
      return 'Rent';

    case 'METERED':
      return 'Metered';

    case 'FIXED':
      return 'Fixed';

    case 'VARIABLE':
      return 'Variable';

    default:
      return kind;
  }
}

function lineSubmissionState(
  line:
    BillingPreviewLine,
) {
  if (
    line.kind ===
    'METERED'
  ) {
    return Boolean(
      line.meterRegisterReadingId,
    );
  }

  if (
    line.kind ===
    'VARIABLE'
  ) {
    return line.amount !==
      undefined;
  }

  return true;
}

export function TenantBillingScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const propertyName =
    route.params
      ?.propertyName as
      | string
      | undefined;

  const paymentDueDay =
    Number(
      route.params
        ?.paymentDueDay ??
      5,
    );

  const mode =
    (
      route.params
        ?.mode as
        | 'TENANT'
        | 'LANDLORD'
        | undefined
    ) ??
    'TENANT';

  const billingPeriod =
    (
      route.params
        ?.billingPeriod as
        | string
        | undefined
    ) ??
    currentBillingPeriod();

  const [
    summary,
    setSummary,
  ] =
    useState<
      TenantBillingSummary | null
    >(null);

  const [
    landlordNote,
    setLandlordNote,
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

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const data =
            await loadTenantBillingSummary(
              tenancyId,
              billingPeriod,
            );

          setSummary(
            data,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Monthly bill',

            billingErrorMessage(
              error,
              'Unable to load the monthly bill.',
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        tenancyId,
        billingPeriod,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void load();
      },

      [
        load,
      ],
    ),
  );

  const paymentState =
    useMemo(
      () =>
        getTenantPaymentState(
          summary?.claim ??
            null,

          billingPeriod,

          paymentDueDay,
        ),

      [
        summary?.claim,
        billingPeriod,
        paymentDueDay,
      ],
    );

  const dueDate =
    paymentDueDate(
      billingPeriod,
      paymentDueDay,
    );

  const openVariableExpense =
    (
      line:
        BillingPreviewLine,
    ) => {
      if (
        !line.propertyServiceId
      ) {
        return;
      }

      navigation.navigate(
        'VariableExpense',
        {
          tenancyId,

          propertyServiceId:
            line.propertyServiceId,

          serviceName:
            line.description,

          currency:
            line.currency,

          billingPeriod,
        },
      );
    };

  const openMeterReading =
    (
      line:
        BillingPreviewLine,
    ) => {
      if (
        !line.meterId
      ) {
        return;
      }

      navigation.navigate(
        'MeterReading',
        {
          meterId:
            line.meterId,

          source:
            mode ===
            'TENANT'
              ? 'TENANT'
              : undefined,
        },
      );
    };

  const confirmPayment =
    () => {
      if (
        busy ||
        summary?.claim?.status !==
          'REPORTED'
      ) {
        return;
      }

      Alert.alert(
        'Confirm payment?',

        'This will create the real payment records, allocate them to the invoices and mark the invoices as paid.',

        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Confirm',

            onPress:
              async () => {
                setBusy(
                  true,
                );

                try {
                  await confirmTenantPayment(
                    {
                      claimId:
                        summary.claim!.id,

                      note:
                        landlordNote,
                    },
                  );

                  setLandlordNote(
                    '',
                  );

                  await load();

                  Alert.alert(
                    'Payment confirmed',

                    'The invoices are now paid and the tenant has been notified.',
                  );
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Unable to confirm payment',

                    billingErrorMessage(
                      error,
                      'Unable to confirm payment.',
                    ),
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

  const rejectPayment =
    () => {
      if (
        busy ||
        summary?.claim?.status !==
          'REPORTED'
      ) {
        return;
      }

      Alert.alert(
        'Reject payment report?',

        'The tenant payment report will be rejected and the bill will return to Pending or Delayed.',

        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Reject',

            style:
              'destructive',

            onPress:
              async () => {
                setBusy(
                  true,
                );

                try {
                  await rejectTenantPayment(
                    {
                      claimId:
                        summary.claim!.id,

                      note:
                        landlordNote,
                    },
                  );

                  setLandlordNote(
                    '',
                  );

                  await load();

                  Alert.alert(
                    'Payment rejected',

                    'The tenant has been notified.',
                  );
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Unable to reject payment',

                    billingErrorMessage(
                      error,
                      'Unable to reject payment.',
                    ),
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

  const pickPaymentProof =
    async (
      source:
        | 'CAMERA'
        | 'GALLERY',
    ) => {
      if (
        busy ||
        !summary?.claim
      ) {
        return;
      }

      try {
        if (
          source ===
          'CAMERA'
        ) {
          const permission =
            await ImagePicker
              .requestCameraPermissionsAsync();

          if (
            !permission.granted
          ) {
            Alert.alert(
              'Camera permission',

              'Camera access is required to take a payment proof photo.',
            );

            return;
          }
        }

        const result =
          source ===
          'CAMERA'
            ? await ImagePicker
                .launchCameraAsync(
                  {
                    mediaTypes: [
                      'images',
                    ],

                    quality:
                      0.8,

                    allowsEditing:
                      false,
                  },
                )

            : await ImagePicker
                .launchImageLibraryAsync(
                  {
                    mediaTypes: [
                      'images',
                    ],

                    quality:
                      0.8,

                    allowsEditing:
                      false,

                    selectionLimit:
                      1,
                  },
                );

        if (
          result.canceled
        ) {
          return;
        }

        const uri =
          result.assets[0]
            ?.uri;

        if (
          !uri
        ) {
          return;
        }

        setBusy(
          true,
        );

        await attachTenantPaymentProof(
          {
            claimId:
              summary.claim.id,

            tenancyId,

            photoUri:
              uri,

            existingProofPath:
              summary.claim
                .proofPath,
          },
        );

        await load();
      } catch (
        error
      ) {
        Alert.alert(
          'Payment proof',

          billingErrorMessage(
            error,
            'Unable to upload payment proof.',
          ),
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  const removePaymentProof =
    () => {
      if (
        busy ||
        !summary?.claim?.proofPath
      ) {
        return;
      }

      Alert.alert(
        'Remove payment proof?',

        'The payment report will remain unchanged.',

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
              async () => {
                setBusy(
                  true,
                );

                try {
                  await removeTenantPaymentProof(
                    {
                      claimId:
                        summary.claim!.id,

                      proofPath:
                        summary.claim!
                          .proofPath,
                    },
                  );

                  await load();
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Payment proof',

                    billingErrorMessage(
                      error,
                      'Unable to remove payment proof.',
                    ),
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

  return (
    <Screen>
      <Header
        title="Monthly bill"
        subtitle={
          `${propertyName ?? 'Apartment'} · ${billingMonthLabel(
            billingPeriod,
          )}`
        }
      />

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading bill...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      summary ? (
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
                    styles.heroTitle
                  }
                >
                  {billingMonthLabel(
                    billingPeriod,
                  )}
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  Payment due{' '}
                  {formatDate(
                    dueDate,
                  )}
                </Text>
              </View>

              <PaymentStatusBadge
                state={
                  paymentState
                }
              />
            </View>
          </Card>

          <SectionTitle
            title="Charges"
          />

          {summary.lines.map(
            line => {
              const submitted =
                lineSubmissionState(
                  line,
                );

              return (
                <Card
                  key={
                    line.key
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
                      <View
                        style={
                          styles.lineTitleRow
                        }
                      >
                        <Text
                          style={
                            styles.lineTitle
                          }
                        >
                          {
                            line.description
                          }
                        </Text>

                        <Badge
                          text={
                            lineLabel(
                              line.kind,
                            )
                          }
                          tone="neutral"
                        />

                        {(line.kind ===
                          'METERED' ||
                          line.kind ===
                          'VARIABLE') ? (
                          <Badge
                            text={
                              submitted
                                ? 'Submitted'
                                : 'Missing'
                            }
                            tone={
                              submitted
                                ? 'success'
                                : 'warning'
                            }
                          />
                        ) : null}
                      </View>
                    </View>

                    <View
                      style={
                        styles.amountWrap
                      }
                    >
                      {line.ready &&
                      line.amount !==
                        undefined ? (
                        <Text
                          style={
                            styles.amount
                          }
                        >
                          {formatMoney(
                            line.amount,
                            line.currency,
                          )}
                        </Text>
                      ) : (
                        <Badge
                          text="Pending"
                          tone="warning"
                        />
                      )}
                    </View>
                  </View>

                  {line.kind ===
                  'VARIABLE' &&
                  !summary.claim ? (
                    <View
                      style={
                        styles.buttonTop
                      }
                    >
                      <SecondaryButton
                        title={
                          submitted
                            ? 'Edit expense'
                            : 'Enter expense'
                        }
                        onPress={() =>
                          openVariableExpense(
                            line,
                          )
                        }
                      />
                    </View>
                  ) : null}

                  {line.kind ===
                    'METERED' &&
                  !submitted &&
                  line.meterId &&
                  !summary.claim ? (
                    <View
                      style={
                        styles.buttonTop
                      }
                    >
                      <SecondaryButton
                        title="Enter meter reading"
                        onPress={() =>
                          openMeterReading(
                            line,
                          )
                        }
                      />
                    </View>
                  ) : null}
                </Card>
              );
            },
          )}

          <SectionTitle
            title="Total"
          />

          <Card>
            {summary.totals.map(
              total => (
                <View
                  key={
                    total.currency
                  }
                  style={
                    styles.totalRow
                  }
                >
                  <Text
                    style={
                      styles.totalCurrency
                    }
                  >
                    {
                      total.currency
                    }
                  </Text>

                  <Text
                    style={
                      styles.totalValue
                    }
                  >
                    {formatMoney(
                      total.total,
                      total.currency,
                    )}
                  </Text>
                </View>
              ),
            )}
          </Card>

          {summary.claim ? (
            <>
              <SectionTitle
                title={
                  mode ===
                  'LANDLORD'
                    ? 'Tenant payment'
                    : 'Payment'
                }
              />

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
                      {summary.claim.status ===
                      'CONFIRMED'
                        ? 'Payment confirmed'
                        : 'Payment reported'}
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      {summary.claim.status ===
                      'CONFIRMED'
                        ? 'The payment has been confirmed and allocated to the invoices.'
                        : 'The tenant reported that this bill has been paid.'}
                    </Text>
                  </View>

                  <PaymentStatusBadge
                    state={
                      summary.claim.status ===
                      'CONFIRMED'
                        ? 'PAID'
                        : 'AWAITING'
                    }
                  />
                </View>

                {summary.claim.invoices.map(
                  invoice => (
                    <View
                      key={
                        invoice.id
                      }
                      style={
                        styles.invoiceRow
                      }
                    >
                      <View
                        style={
                          styles.flex
                        }
                      >
                        <Text
                          style={
                            styles.invoiceNumber
                          }
                        >
                          {
                            invoice.number
                          }
                        </Text>

                        <Text
                          style={
                            styles.muted
                          }
                        >
                          {
                            invoice.currency
                          }
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.invoiceAmount
                        }
                      >
                        {formatMoney(
                          invoice.total,
                          invoice.currency,
                        )}
                      </Text>
                    </View>
                  ),
                )}
              </Card>

              <Card>
                <Text
                  style={
                    styles.title
                  }
                >
                  Payment proof
                </Text>

                {summary.claim.proofUri ? (
                  <Image
                    source={{
                      uri:
                        summary.claim
                          .proofUri,
                    }}
                    style={
                      styles.proofPhoto
                    }
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={
                      styles.emptyProof
                    }
                  >
                    <Text
                      style={
                        styles.emptyProofText
                      }
                    >
                      No proof attached
                    </Text>
                  </View>
                )}

                {mode ===
                'TENANT' ? (
                  <>
                    <View
                      style={
                        styles.proofActions
                      }
                    >
                      <View
                        style={
                          styles.flex
                        }
                      >
                        <SecondaryButton
                          title="Take photo"
                          onPress={() =>
                            void pickPaymentProof(
                              'CAMERA',
                            )
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.flex
                        }
                      >
                        <SecondaryButton
                          title="Gallery"
                          onPress={() =>
                            void pickPaymentProof(
                              'GALLERY',
                            )
                          }
                        />
                      </View>
                    </View>

                    {summary.claim.proofPath ? (
                      <Pressable
                        onPress={
                          removePaymentProof
                        }
                      >
                        <Text
                          style={
                            styles.removeProof
                          }
                        >
                          Remove proof
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </Card>
            </>
          ) : null}

          {mode ===
            'LANDLORD' &&
          summary.claim?.status ===
            'REPORTED' ? (
            <>
              <SectionTitle
                title="Confirmation"
              />

              <Card>
                <Text
                  style={
                    styles.title
                  }
                >
                  Did you receive this payment?
                </Text>

                <Text
                  style={
                    styles.muted
                  }
                >
                  Confirm only after the money has actually been received.
                </Text>

                <Field
                  label="Note"
                  value={
                    landlordNote
                  }
                  onChangeText={
                    setLandlordNote
                  }
                  placeholder="Optional confirmation or rejection note"
                  editable={
                    !busy
                  }
                  multiline
                />

                <PrimaryButton
                  title={
                    busy
                      ? 'Saving...'
                      : 'Confirm payment'
                  }
                  disabled={
                    busy
                  }
                  onPress={
                    confirmPayment
                  }
                />

                <Pressable
                  onPress={
                    rejectPayment
                  }
                  style={
                    styles.rejectButton
                  }
                >
                  <Text
                    style={
                      styles.rejectText
                    }
                  >
                    Reject / Not received
                  </Text>
                </Pressable>
              </Card>
            </>
          ) : null}

          {mode ===
            'TENANT' &&
          !summary.claim ? (
            <Card>
              <SecondaryButton
                title="Back to apartment"
                onPress={() =>
                  navigation.goBack()
                }
              />
            </Card>
          ) : null}
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

    heroTitle: {
      color:
        colors.text,

      fontSize:
        20,

      fontWeight:
        '900',
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

    lineTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',

      gap:
        8,
    },

    lineTitle: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    amountWrap: {
      alignItems:
        'flex-end',
    },

    amount: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },

    totalRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      paddingVertical:
        10,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    totalCurrency: {
      color:
        colors.muted,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    totalValue: {
      color:
        colors.text,

      fontSize:
        20,

      fontWeight:
        '900',
    },

    invoiceRow: {
      flexDirection:
        'row',

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

      marginTop:
        spacing.sm,
    },

    invoiceNumber: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    invoiceAmount: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    proofPhoto: {
      width:
        '100%',

      height:
        220,

      borderRadius:
        radius.sm,

      marginVertical:
        spacing.md,

      backgroundColor:
        colors.border,
    },

    emptyProof: {
      height:
        120,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        1,

      borderStyle:
        'dashed',

      borderColor:
        colors.border,

      borderRadius:
        radius.sm,

      marginVertical:
        spacing.md,
    },

    emptyProofText: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    proofActions: {
      flexDirection:
        'row',

      gap:
        spacing.sm,
    },

    removeProof: {
      color:
        '#B42318',

      fontSize:
        12,

      fontWeight:
        '700',

      textAlign:
        'center',

      marginTop:
        spacing.md,
    },

    rejectButton: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight:
        46,

      marginTop:
        spacing.sm,

      borderRadius:
        radius.sm,

      borderWidth:
        1,

      borderColor:
        '#FCA5A5',

      backgroundColor:
        '#FEF2F2',
    },

    rejectText: {
      color:
        '#B42318',

      fontSize:
        14,

      fontWeight:
        '800',
    },
  });