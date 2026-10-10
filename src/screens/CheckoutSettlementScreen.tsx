import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  useMutation,
  useQuery,
} from '@tanstack/react-query';

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
  CheckoutSettlementPreview,
  completeCheckoutWithSettlement,
  loadCheckoutSettlementPreview,
} from '../services/checkoutSettlementRepository';

import {
  invalidateCheckoutData,
  queryKeys,
} from '../lib/queryClient';

import {
  colors,
  spacing,
} from '../theme';


type SettlementMode =
  | 'RETURN_FULL'
  | 'APPLY_AND_RETURN'
  | 'CUSTOM'
  | 'RETAIN_ALL';


function money(
  amount:
    number,

  currency?:
    string,
) {
  return `${amount.toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  )}${currency
    ? ` ${currency}`
    : ''}`;
}


function parseAmount(
  value:
    string,
) {
  const result =
    Number(
      value
        .trim()
        .replace(
          ',',
          '.',
        ),
    );

  return Number.isFinite(
    result,
  )
    ? Math.max(
        0,
        result,
      )
    : 0;
}


function errorMessage(
  error:
    unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      'object' &&
    'message' in error
  ) {
    return String(
      (
        error as {
          message:
            unknown;
        }
      ).message,
    );
  }

  return 'Unknown error.';
}


function ModeButton({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title:
    string;

  subtitle:
    string;

  selected:
    boolean;

  onPress:
    () => void;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.mode,

        selected &&
          styles.modeSelected,

        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={[
          styles.radio,

          selected &&
            styles.radioSelected,
        ]}
      >
        {selected ? (
          <View
            style={
              styles.radioInner
            }
          />
        ) : null}
      </View>

      <View
        style={
          styles.flex
        }
      >
        <Text
          style={
            styles.modeTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}


export function CheckoutSettlementScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const propertyId =
    route.params
      ?.propertyId as
      | string
      | undefined;

  const propertyName =
    route.params
      ?.propertyName as
      | string
      | undefined;


  const [
    mode,
    setMode,
  ] =
    useState<SettlementMode>(
      'APPLY_AND_RETURN',
    );

  const [
    customApply,
    setCustomApply,
  ] =
    useState(
      '0.00',
    );

  const [
    customReturn,
    setCustomReturn,
  ] =
    useState(
      '0.00',
    );

  const [
    customRetain,
    setCustomRetain,
  ] =
    useState(
      '0.00',
    );

  const [
    note,
    setNote,
  ] =
    useState(
      '',
    );


  const seedRef =
    useRef<
      string | null
    >(
      null,
    );


  const {
    data:
      preview,

    error,

    isPending,

    isFetching,

    refetch,
  } =
    useQuery({
      queryKey:
        queryKeys.checkoutSettlement(
          tenancyId,
        ),

      queryFn:
        () =>
          loadCheckoutSettlementPreview(
            tenancyId,
          ),

      enabled:
        Boolean(
          tenancyId,
        ),
    });


  /*
   * Initialize custom inputs once for each meaningful
   * settlement snapshot.
   *
   * A background refetch must not overwrite values the landlord
   * is currently editing.
   */
  useEffect(
    () => {
      if (
        !preview
      ) {
        return;
      }

      const seed =
        [
          preview.depositAmount,
          preview.outstandingAmount,
          preview.depositCurrency ??
            '',
        ].join(
          ':',
        );


      if (
        seedRef.current ===
        seed
      ) {
        return;
      }


      seedRef.current =
        seed;


      const automaticApply =
        Math.min(
          preview.depositAmount,
          preview.outstandingAmount,
        );


      setCustomApply(
        automaticApply.toFixed(
          2,
        ),
      );

      setCustomReturn(
        Math.max(
          preview.depositAmount -
            automaticApply,
          0,
        ).toFixed(
          2,
        ),
      );

      setCustomRetain(
        '0.00',
      );
    },
    [
      preview,
    ],
  );


  const settlement =
    useMemo(
      () => {
        if (
          !preview
        ) {
          return {
            apply:
              0,

            returned:
              0,

            retained:
              0,
          };
        }


        const deposit =
          preview.depositAmount;


        if (
          deposit <=
          0
        ) {
          return {
            apply:
              0,

            returned:
              0,

            retained:
              0,
          };
        }


        if (
          mode ===
          'RETURN_FULL'
        ) {
          return {
            apply:
              0,

            returned:
              deposit,

            retained:
              0,
          };
        }


        if (
          mode ===
          'APPLY_AND_RETURN'
        ) {
          const apply =
            Math.min(
              deposit,
              preview.outstandingAmount,
            );

          return {
            apply,

            returned:
              Math.max(
                deposit -
                  apply,
                0,
              ),

            retained:
              0,
          };
        }


        if (
          mode ===
          'RETAIN_ALL'
        ) {
          return {
            apply:
              0,

            returned:
              0,

            retained:
              deposit,
          };
        }


        return {
          apply:
            parseAmount(
              customApply,
            ),

          returned:
            parseAmount(
              customReturn,
            ),

          retained:
            parseAmount(
              customRetain,
            ),
        };
      },
      [
        preview,
        mode,
        customApply,
        customReturn,
        customRetain,
      ],
    );


  const settlementTotal =
    settlement.apply +
    settlement.returned +
    settlement.retained;


  const valid =
    preview
      ? Math.abs(
          settlementTotal -
            preview.depositAmount,
        ) <=
          0.01 &&
        settlement.apply <=
          preview.outstandingAmount +
            0.01
      : false;


  const completeMutation =
    useMutation({
      mutationFn:
        async () => {
          if (
            !preview
          ) {
            throw new Error(
              'Checkout settlement is not loaded.',
            );
          }


          return completeCheckoutWithSettlement(
            {
              tenancyId,

              applyAmount:
                settlement.apply,

              returnAmount:
                settlement.returned,

              retainAmount:
                settlement.retained,

              note,
            },
          );
        },


      onSuccess:
        async () => {
          await invalidateCheckoutData(
            tenancyId,
            propertyId,
          );


          Alert.alert(
            'Checkout completed',
            'The tenancy has been closed successfully.',
            [
              {
                text:
                  'OK',

                onPress:
                  () => {
                    navigation.reset(
                      {
                        index:
                          0,

                        routes: [
                          {
                            name:
                              'Main',
                          },
                        ],
                      },
                    );
                  },
              },
            ],
          );
        },


      onError:
        mutationError => {
          Alert.alert(
            'Unable to complete checkout',

            errorMessage(
              mutationError,
            ),
          );
        },
    });


  const complete =
    () => {
      if (
        !preview ||
        completeMutation.isPending
      ) {
        return;
      }


      if (
        !preview.readingsReady
      ) {
        Alert.alert(
          'Checkout',
          'All final meter readings must be submitted first.',
        );

        return;
      }


      if (
        !preview.finalBillingReady
      ) {
        Alert.alert(
          'Checkout',
          'Confirm the final checkout bill first.',
        );

        return;
      }


      if (
        !valid
      ) {
        Alert.alert(
          'Deposit settlement',

          `The settlement must equal ${money(
            preview.depositAmount,
            preview.depositCurrency,
          )}.`,
        );

        return;
      }


      Alert.alert(
        'Complete checkout?',

        'The tenancy will be ended and the apartment will become vacant.',

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
              () => {
                completeMutation.mutate();
              },
          },
        ],
      );
    };


  if (
    isPending
  ) {
    return (
      <Screen>
        <Header
          title="Deposit settlement"
          subtitle={
            propertyName ??
            'Checkout'
          }
        />

        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading checkout...
          </Text>
        </Card>
      </Screen>
    );
  }


  if (
    error ||
    !preview
  ) {
    return (
      <Screen>
        <Header
          title="Deposit settlement"
          subtitle={
            propertyName
          }
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            Settlement is not available.
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {error
              ? errorMessage(
                  error,
                )
              : 'No settlement data was returned.'}
          </Text>
        </Card>

        <SecondaryButton
          title={
            isFetching
              ? 'Refreshing...'
              : 'Try again'
          }
          onPress={() => {
            if (
              !isFetching
            ) {
              void refetch();
            }
          }}
        />
      </Screen>
    );
  }


  return (
    <Screen>
      <Header
        title="Deposit settlement"
        subtitle={
          propertyName ??
          'Complete checkout'
        }
        right={
          <Badge
            text="Final step"
            tone="warning"
          />
        }
      />


      {!preview.readingsReady ? (
        <Card>
          <Text
            style={
              styles.warningTitle
            }
          >
            Final readings are incomplete
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            The tenant must submit all final meter readings before checkout can be completed.
          </Text>
        </Card>
      ) : null}


      {!preview.finalBillingReady ? (
        <Card>
          <Text
            style={
              styles.warningTitle
            }
          >
            Final bill is not confirmed
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Review and confirm the final checkout bill first.
          </Text>
        </Card>
      ) : null}


      <SectionTitle
        title="Security deposit"
      />


      <Card>
        <View
          style={
            styles.moneyRow
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Available deposit
          </Text>

          <Text
            style={
              styles.bigMoney
            }
          >
            {money(
              preview.depositAmount,
              preview.depositCurrency,
            )}
          </Text>
        </View>


        <View
          style={
            styles.separator
          }
        />


        <View
          style={
            styles.moneyRow
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Outstanding
          </Text>

          <Text
            style={
              styles.value
            }
          >
            {money(
              preview.outstandingAmount,
              preview.depositCurrency,
            )}
          </Text>
        </View>


        {preview.depositAmount >
          0 &&
        !preview.depositCurrency ? (
          <Text
            style={
              styles.errorText
            }
          >
            Deposit currency is missing.
          </Text>
        ) : null}
      </Card>


      {preview.depositAmount >
      0 ? (
        <>
          <SectionTitle
            title="Settlement"
          />

          <Card>
            <ModeButton
              title="Return full deposit"
              subtitle={`Return ${money(
                preview.depositAmount,
                preview.depositCurrency,
              )} to the tenant.`}
              selected={
                mode ===
                'RETURN_FULL'
              }
              onPress={() =>
                setMode(
                  'RETURN_FULL',
                )
              }
            />

            <ModeButton
              title="Apply to balance, return the rest"
              subtitle={
                preview.outstandingAmount >
                0
                  ? 'Use the deposit to cover outstanding invoices first.'
                  : 'There is currently no outstanding balance in this currency.'
              }
              selected={
                mode ===
                'APPLY_AND_RETURN'
              }
              onPress={() =>
                setMode(
                  'APPLY_AND_RETURN',
                )
              }
            />

            <ModeButton
              title="Custom settlement"
              subtitle="Choose exactly how much to apply, return or retain."
              selected={
                mode ===
                'CUSTOM'
              }
              onPress={() =>
                setMode(
                  'CUSTOM',
                )
              }
            />

            <ModeButton
              title="Retain full deposit"
              subtitle="Record the entire deposit as retained at checkout."
              selected={
                mode ===
                'RETAIN_ALL'
              }
              onPress={() =>
                setMode(
                  'RETAIN_ALL',
                )
              }
            />
          </Card>
        </>
      ) : null}


      {mode ===
        'CUSTOM' &&
      preview.depositAmount >
        0 ? (
        <>
          <SectionTitle
            title="Custom amounts"
          />

          <Card>
            <Text
              style={
                styles.inputLabel
              }
            >
              Apply to outstanding balance
            </Text>

            <TextInput
              value={
                customApply
              }
              onChangeText={
                setCustomApply
              }
              keyboardType="decimal-pad"
              style={
                styles.input
              }
              placeholder="0.00"
            />


            <Text
              style={
                styles.inputLabel
              }
            >
              Return to tenant
            </Text>

            <TextInput
              value={
                customReturn
              }
              onChangeText={
                setCustomReturn
              }
              keyboardType="decimal-pad"
              style={
                styles.input
              }
              placeholder="0.00"
            />


            <Text
              style={
                styles.inputLabel
              }
            >
              Retain
            </Text>

            <TextInput
              value={
                customRetain
              }
              onChangeText={
                setCustomRetain
              }
              keyboardType="decimal-pad"
              style={
                styles.input
              }
              placeholder="0.00"
            />
          </Card>
        </>
      ) : null}


      <SectionTitle
        title="Summary"
      />


      <Card>
        <View
          style={
            styles.summaryRow
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Applied to debt
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {money(
              settlement.apply,
              preview.depositCurrency,
            )}
          </Text>
        </View>


        <View
          style={
            styles.summaryRow
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Return to tenant
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {money(
              settlement.returned,
              preview.depositCurrency,
            )}
          </Text>
        </View>


        <View
          style={
            styles.summaryRow
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Retained
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {money(
              settlement.retained,
              preview.depositCurrency,
            )}
          </Text>
        </View>


        <View
          style={
            styles.separator
          }
        />


        <View
          style={
            styles.summaryRow
          }
        >
          <Text
            style={
              styles.totalLabel
            }
          >
            Total settlement
          </Text>

          <Text
            style={
              styles.totalValue
            }
          >
            {money(
              settlementTotal,
              preview.depositCurrency,
            )}
          </Text>
        </View>


        {!valid ? (
          <Text
            style={
              styles.errorText
            }
          >
            Settlement must equal the available deposit and cannot apply more than the outstanding balance.
          </Text>
        ) : null}
      </Card>


      <SectionTitle
        title="Note"
      />


      <Card>
        <TextInput
          value={
            note
          }
          onChangeText={
            setNote
          }
          multiline
          style={[
            styles.input,
            styles.noteInput,
          ]}
          placeholder="Optional settlement note"
          textAlignVertical="top"
        />
      </Card>


      <PrimaryButton
        title={
          completeMutation.isPending
            ? 'Completing checkout...'
            : 'Complete checkout'
        }
        onPress={
          complete
        }
      />


      <SecondaryButton
        title="Back"
        onPress={() =>
          navigation.goBack()
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

    pressed: {
      opacity:
        0.7,
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
        3,
    },

    warningTitle: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    moneyRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    label: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    value: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    bigMoney: {
      color:
        colors.text,

      fontSize:
        20,

      fontWeight:
        '900',
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    mode: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        spacing.md,

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        14,

      padding:
        14,

      marginBottom:
        10,
    },

    modeSelected: {
      borderColor:
        colors.primary,

      backgroundColor:
        '#F5F8FF',
    },

    radio: {
      width:
        20,

      height:
        20,

      borderRadius:
        10,

      borderWidth:
        2,

      borderColor:
        colors.border,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        1,
    },

    radioSelected: {
      borderColor:
        colors.primary,
    },

    radioInner: {
      width:
        10,

      height:
        10,

      borderRadius:
        5,

      backgroundColor:
        colors.primary,
    },

    modeTitle: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    inputLabel: {
      color:
        colors.muted,

      fontSize:
        11,

      fontWeight:
        '700',

      textTransform:
        'uppercase',

      marginBottom:
        6,

      marginTop:
        8,
    },

    input: {
      minHeight:
        46,

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        12,

      paddingHorizontal:
        12,

      paddingVertical:
        10,

      color:
        colors.text,

      backgroundColor:
        '#FFFFFF',

      fontSize:
        14,
    },

    noteInput: {
      minHeight:
        100,
    },

    summaryRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      gap:
        spacing.md,

      paddingVertical:
        7,
    },

    summaryValue: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    totalLabel: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    totalValue: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '900',
    },

    errorText: {
      color:
        '#B91C1C',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '700',

      marginTop:
        spacing.md,
    },
  });