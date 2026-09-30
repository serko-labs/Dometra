import React, {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
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
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  acceptTenantInvitation,
  getMyTenantProfile,
  getTenantInvitation,
} from '../services/tenantRepository';

import {
  TenantInvitation,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  value?: string,
) {
  if (
    !value
  ) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString();
}

export function TenantInvitationScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    session,
    setMode,
  } =
    useApp();

  const token =
    route.params
      ?.token as
      | string
      | undefined;

  const [
    invitation,
    setInvitation,
  ] =
    useState<
      TenantInvitation | null
    >(null);

  const [
    profileComplete,
    setProfileComplete,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  useFocusEffect(
    useCallback(
      () => {
        if (
          !session ||
          !token
        ) {
          return;
        }

        let active =
          true;

        const load =
          async () => {
            setLoading(true);

            try {
              const [
                invitationData,
                profile,
              ] =
                await Promise.all([
                  getTenantInvitation(
                    token,
                  ),
                  getMyTenantProfile(),
                ]);

              if (
                !active
              ) {
                return;
              }

              setInvitation(
                invitationData,
              );

              setProfileComplete(
                Boolean(
                  profile?.firstName &&
                  profile?.lastName &&
                  profile?.phone &&
                  profile?.email,
                ),
              );
            } catch (
              error
            ) {
              if (
                active
              ) {
                Alert.alert(
                  'Invitation',
                  error instanceof Error
                    ? error.message
                    : 'Unable to load invitation.',
                );
              }
            } finally {
              if (
                active
              ) {
                setLoading(false);
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
        session,
        token,
      ],
    ),
  );

  const accept =
    async () => {
      if (
        !token
      ) {
        return;
      }

      if (
        !profileComplete
      ) {
        navigation.navigate(
          'TenantProfile',
          {
            mode:
              'SELF',

            inviteToken:
              token,
          },
        );

        return;
      }

      setBusy(true);

      try {
        await acceptTenantInvitation(
          token,
        );

        await setMode(
          'TENANT',
        );

        Alert.alert(
          'Invitation accepted',
          'The apartment is now available in Tenant mode.',
          [
            {
              text:
                'Open Dometra',

              onPress:
                () => {
                  navigation.reset({
                    index:
                      0,

                    routes: [
                      {
                        name:
                          'Main',
                      },
                    ],
                  });
                },
            },
          ],
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to accept invitation',
          error instanceof Error
            ? error.message
            : 'Unknown error.',
        );
      } finally {
        setBusy(false);
      }
    };

  if (
    !token
  ) {
    return (
      <Screen>
        <Header
          title="Invitation"
          subtitle="Invalid invitation link"
        />
      </Screen>
    );
  }

  if (
    !session
  ) {
    return (
      <Screen>
        <Header
          title="Apartment invitation"
          subtitle="Sign in to continue"
        />

        <Card>
          <Text
            style={
              styles.title
            }
          >
            Dometra account required
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            Sign in or create a Dometra account.
            After authentication you can return to this invitation and accept the tenancy.
          </Text>
        </Card>

        <PrimaryButton
          title="Sign in / Register"
          onPress={() =>
            navigation.navigate(
              'Auth',
            )
          }
        />
      </Screen>
    );
  }

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title="Apartment invitation"
          subtitle="Loading invitation..."
        />
      </Screen>
    );
  }

  if (
    !invitation
  ) {
    return (
      <Screen>
        <Header
          title="Apartment invitation"
          subtitle="This invitation is unavailable or expired"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Apartment invitation"
        subtitle="Review the rental terms before accepting"
      />

      <Card>
        <Text
          style={
            styles.title
          }
        >
          {invitation.propertyName}
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          {invitation.propertyAddress}, {invitation.propertyCity}
        </Text>

        <View
          style={
            styles.separator
          }
        />

        <View
          style={
            styles.row
          }
        >
          <View>
            <Text
              style={
                styles.label
              }
            >
              Rent
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {invitation.rentAmount} {invitation.currency}
            </Text>
          </View>

          <View
            style={
              styles.alignRight
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Payment due
            </Text>

            <Text
              style={
                styles.value
              }
            >
              Day {invitation.paymentDueDay}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.separator
          }
        />

        <Text
          style={
            styles.label
          }
        >
          Start date
        </Text>

        <Text
          style={
            styles.value
          }
        >
          {formatDate(
            invitation.startDate,
          )}
        </Text>

        {invitation.endDate ? (
          <>
            <Text
              style={
                styles.labelTop
              }
            >
              End date
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {formatDate(
                invitation.endDate,
              )}
            </Text>
          </>
        ) : null}

        {invitation.depositAmount !==
        undefined ? (
          <>
            <Text
              style={
                styles.labelTop
              }
            >
              Security deposit
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {invitation.depositAmount} {invitation.depositCurrency ?? invitation.currency}
            </Text>
          </>
        ) : null}
      </Card>

      {!profileComplete ? (
        <Card>
          <Text
            style={
              styles.title
            }
          >
            Complete your tenant profile
          </Text>

          <Text
            style={
              styles.muted
            }
          >
            First name, last name, phone and email are required before you can accept the invitation.
          </Text>

          <View
            style={
              styles.buttonTop
            }
          >
            <SecondaryButton
              title="Complete profile"
              onPress={() =>
                navigation.navigate(
                  'TenantProfile',
                  {
                    mode:
                      'SELF',

                    inviteToken:
                      token,
                  },
                )
              }
            />
          </View>
        </Card>
      ) : null}

      <PrimaryButton
        title={
          busy
            ? 'Accepting...'
            : profileComplete
              ? 'Accept invitation'
              : 'Complete profile to continue'
        }
        disabled={
          busy
        }
        onPress={() =>
          void accept()
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
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
        5,
    },

    label: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    labelTop: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',

      marginTop:
        spacing.md,
    },

    value: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '800',

      marginTop:
        4,
    },

    row: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    alignRight: {
      alignItems:
        'flex-end',
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },
  });
