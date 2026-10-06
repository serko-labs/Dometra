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
  Header,
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
  currentBillingPeriod,
  getTenantPaymentState,
  loadTenantBillingSummary,
  paymentDueDate,
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

        'The invoice and paid status will remain unchanged.',

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
                text={
                  paymentState ===
                  'PAID'
                    ? 'Paid'

                    : paymentState ===
                        'OVERDUE'
                      ? 'Overdue'

                      : 'Due'
                }
              />
            </View>

            {!summary.ready &&
            !summary.claim ? (
              <View
                style={
                  styles.notice
                }
              >
                <Text
                  style={
                    styles.noticeTitle
                  }
                >
                  Bill is not ready yet
                </Text>

                <Text
                  style={
                    styles.noticeText
                  }
                >
                  {summary.missingCount}{' '}
                  billing item
                  {summary.missingCount ===
                  1
                    ? ''
                    : 's'}{' '}
                  still need a value or tariff.
                </Text>
              </View>
            ) : null}
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

                      {line.kind ===
                        'METERED' &&
                      line.quantity !==
                        undefined &&
                      line.unitPrice !==
                        undefined ? (
                        <Text
                          style={
                            styles.muted
                          }
                        >
                          {line.quantity.toLocaleString()}{' '}
                          {line.unit ?? ''}{' '}
                          ×{' '}
                          {formatMoney(
                            line.unitPrice,
                            line.currency,
                          )}
                        </Text>
                      ) : null}
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
                          text="Bill pending"
                          tone="warning"
                        />
                      )}
                    </View>
                  </View>

                  {line.kind ===
                  'VARIABLE' ? (
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
                  line.meterId ? (
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
            {summary.totals.length ===
            0 ? (
              <Text
                style={
                  styles.muted
                }
              >
                No completed charge totals yet.
              </Text>
            ) : null}

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

            {summary.totals.length >
            1 ? (
              <Text
                style={
                  styles.currencyHint
                }
              >
                Different currencies stay separate. Dometra does not combine USD, EUR and UAH into one total.
              </Text>
            ) : null}
          </Card>

          {!summary.claim &&
          mode ===
            'TENANT' ? (
            <Card>
              <Text
                style={
                  styles.title
                }
              >
                Payment action
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                The Paid button is on the apartment screen. This screen is only for reviewing all bill components and attaching proof after payment.
              </Text>

              <View
                style={
                  styles.buttonTop
                }
              >
                <SecondaryButton
                  title="Back to apartment"
                  onPress={() =>
                    navigation.goBack()
                  }
                />
              </View>
            </Card>
          ) : null}

          {summary.claim ? (
            <>
              <SectionTitle
                title="Payment record"
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
                      Payment marked as paid
                    </Text>

                    <Text
                      style={
                        styles.muted
                      }
                    >
                      The landlord has been notified. This status is based on the tenant payment report.
                    </Text>
                  </View>

                  <PaymentStatusBadge
                    state="PAID"
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
                          Invoice ·{' '}
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

              {mode ===
              'TENANT' ? (
                <Card>
                  <Text
                    style={
                      styles.title
                    }
                  >
                    Payment proof
                  </Text>

                  <Text
                    style={
                      styles.muted
                    }
                  >
                    Optional. Add a screenshot, receipt, bank transfer confirmation or photo of the payment document.
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
                          styles.emptyProofIcon
                        }
                      >
                        ▧
                      </Text>

                      <Text
                        style={
                          styles.emptyProofText
                        }
                      >
                        No payment proof attached
                      </Text>
                    </View>
                  )}

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
                        title={
                          summary.claim
                            .proofUri
                            ? 'Retake'
                            : 'Take photo'
                        }
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
                </Card>
              ) : null}
            </>
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

    notice: {
      marginTop:
        spacing.md,

      padding:
        spacing.md,

      borderRadius:
        radius.sm,

      backgroundColor:
        '#FEF3C7',
    },

    noticeTitle: {
      color:
        '#92400E',

      fontSize:
        13,

      fontWeight:
        '800',
    },

    noticeText: {
      color:
        '#92400E',

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        3,
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

      textAlign:
        'right',
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

      alignItems:
        'center',

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

    currencyHint: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        spacing.md,
    },

    invoiceRow: {
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
        150,

      borderWidth:
        1,

      borderStyle:
        'dashed',

      borderColor:
        colors.border,

      borderRadius:
        radius.sm,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        6,

      marginVertical:
        spacing.md,
    },

    emptyProofIcon: {
      color:
        colors.muted,

      fontSize:
        30,
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
  });