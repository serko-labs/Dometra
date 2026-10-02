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
  useTranslation,
} from 'react-i18next';

import {
  Badge,
  Card,
  Header,
  PrimaryButton,
  Screen,
  SectionTitle,
} from '../components/ui';

import {
  getLocaleTag,
} from '../i18n/language';

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

function todayLocalDate() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() +
        1,
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

function isValidDate(
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
    value.includes(
      'T',
    )
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

export function CheckoutTenantScreen() {
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
    context,
    setContext,
  ] =
    useState<
      CheckoutContext | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

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
    useState(
      '',
    );

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
                active
              ) {
                setContext(
                  result,
                );

                /*
                 * Final readings must always
                 * start blank.
                 */
                setReadingValues(
                  {},
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
                    'endRental',
                  ),

                  error instanceof
                  Error
                    ? error.message
                    : t(
                        'unableLoadCheckout',
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

  const enteredReadingCount =
    useMemo(
      () =>
        Object.values(
          readingValues,
        ).filter(
          value =>
            value.trim()
              .length >
            0,
        ).length,

      [
        readingValues,
      ],
    );

  const buildReadings =
    () => {
      if (
        !context
      ) {
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

        if (
          !raw
        ) {
          continue;
        }

        const value =
          Number(
            raw.replace(
              ',',
              '.',
            ),
          );

        if (
          !Number.isFinite(
            value,
          ) ||
          value <
            0
        ) {
          throw new Error(
            t(
              'invalidFinalReading',

              {
                meter:
                  register.meterName,

                register:
                  register.registerCode,
              },
            ),
          );
        }

        result.push({
          meterRegisterId:
            register.id,

          value,
        });
      }

      return result;
    };

  const performCheckout =
    async () => {
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
        await checkoutTenancy({
          tenancyId:
            context.tenancyId,

          checkoutDate:
            checkoutDate.trim(),

          notes,

          readings:
            buildReadings(),
        });

        Alert.alert(
          t(
            'rentalEnded',
          ),

          t(
            'rentalEndedMessage',
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
            'unableEndRental',
          ),

          error instanceof
          Error
            ? error.message
            : t(
                'pleaseTryAgain',
              ),
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  const submit =
    () => {
      if (
        !context ||
        saving
      ) {
        return;
      }

      const date =
        checkoutDate.trim();

      if (
        !isValidDate(
          date,
        )
      ) {
        Alert.alert(
          t(
            'checkoutDate',
          ),

          t(
            'enterValidCheckoutDate',
          ),
        );

        return;
      }

      if (
        date <
        context.startDate
      ) {
        Alert.alert(
          t(
            'checkoutDate',
          ),

          t(
            'checkoutDateBeforeStart',
          ),
        );

        return;
      }

      if (
        date >
        todayLocalDate()
      ) {
        Alert.alert(
          t(
            'checkoutDate',
          ),

          t(
            'checkoutDateFuture',
          ),
        );

        return;
      }

      try {
        buildReadings();
      } catch (
        error
      ) {
        Alert.alert(
          t(
            'finalMeterReadings',
          ),

          error instanceof
          Error
            ? error.message
            : t(
                'checkFinalMeterReadings',
              ),
        );

        return;
      }

      Alert.alert(
        t(
          'endRentalConfirmTitle',
        ),

        t(
          'endRentalConfirmMessage',
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
                'endRental',
              ),

            style:
              'destructive',

            onPress:
              () =>
                void performCheckout(),
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
              'endRental',
            )
          }
          subtitle={
            t(
              'loadingCheckout',
            )
          }
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
          title={
            t(
              'endRental',
            )
          }
          subtitle={
            t(
              'noActiveRental',
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
              'noActiveOrCheckoutPendingRental',
            )}
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
        title={
          t(
            'endRental',
          )
        }
        subtitle={
          context.propertyTitle
        }
        right={
          <Badge
            text={
              checkoutRequired
                ? t(
                    'checkoutRequired',
                  )
                : t(
                    'active',
                  )
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
            {t(
              'rentalTermEnded',
            )}
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            {t(
              'completeCheckoutDescription',
            )}
          </Text>
        </Card>
      ) : null}

      <SectionTitle
        title={
          t(
            'checkout',
          )
        }
      />

      <Card>
        <Text
          style={
            styles.label
          }
        >
          {t(
            'checkoutDateRequired',
          )}
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
          {t(
            'rentalStarted',

            {
              date:
                formatDate(
                  context.startDate,
                  locale,
                ),
            },
          )}

          {context.endDate
            ? ` • ${t(
                'agreementEndsInline',

                {
                  date:
                    formatDate(
                      context.endDate,
                      locale,
                    ),
                },
              )}`
            : ''}
        </Text>
      </Card>

      <SectionTitle
        title={
          t(
            'finalMeterReadings',
          )
        }
      />

      <Card>
        {context.registers.length ===
        0 ? (
          <Text
            style={
              styles.muted
            }
          >
            {t(
              'noActiveMetersForApartment',
            )}
          </Text>
        ) : (
          <>
            <Text
              style={
                styles.muted
              }
            >
              {t(
                'finalReadingsOptionalHint',
              )}
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
                    placeholder={
                      t(
                        'finalReading',
                      )
                    }
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
        title={
          t(
            'notes',
          )
        }
      />

      <Card>
        <TextInput
          value={
            notes
          }
          onChangeText={
            setNotes
          }
          placeholder={
            t(
              'optionalCheckoutNotes',
            )
          }
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
          {t(
            'whatHappensNext',
          )}
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          {t(
            'checkoutResultDescription',
          )}
        </Text>

        <Text
          style={
            styles.helper
          }
        >
          {t(
            'finalReadingsEntered',

            {
              count:
                enteredReadingCount,
            },
          )}
        </Text>
      </Card>

      <PrimaryButton
        title={
          saving
            ? t(
                'endingRental',
              )
            : t(
                'endRental',
              )
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
      flex:
        1,
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