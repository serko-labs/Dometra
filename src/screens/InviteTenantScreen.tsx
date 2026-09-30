import React from 'react';

import {
  Alert,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
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
  CreatedTenantInvitation,
  TenancyTermsInput,
} from '../types';

import {
  colors,
  spacing,
} from '../theme';

function formatDate(
  value: string,
) {
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

export function InviteTenantScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    state,
  } =
    useApp();

  const propertyId =
    route.params
      ?.propertyId as string;

  const invitation =
    route.params
      ?.invitation as
      CreatedTenantInvitation;

  const terms =
    route.params
      ?.terms as
      TenancyTermsInput;

  const property =
    state.properties.find(
      (
        item,
      ) =>
        item.id ===
        propertyId,
    );

  const shareInvitation =
    async () => {
      try {
        const apartmentName =
          property?.name ??
          'your apartment';

        const message =
          [
            `You've been invited to ${apartmentName} in Dometra.`,
            '',
            `Rent: ${terms.rentAmount} ${terms.currency} / month`,
            `Start date: ${terms.startDate}`,
            `Payment due: day ${terms.paymentDueDay} of each month`,
            '',
            'Open the invitation:',
            invitation.link,
          ].join('\n');

        await Share.share({
          message,
        });
      } catch (
        error
      ) {
        Alert.alert(
          'Unable to share invitation',
          error instanceof Error
            ? error.message
            : 'Unknown error.',
        );
      }
    };

  const done =
    () => {
      navigation.popTo(
        'PropertyDetails',
        {
          propertyId,
        },
      );
    };

  return (
    <Screen>
      <Header
        title="Tenant invitation"
        subtitle="The invitation is ready to share"
      />

      <Card>
        <Text
          style={
            styles.label
          }
        >
          Apartment
        </Text>

        <Text
          style={
            styles.value
          }
        >
          {property?.name ??
            'Apartment'}
        </Text>

        {property ? (
          <Text
            style={
              styles.muted
            }
          >
            {property.address}, {property.city}
          </Text>
        ) : null}

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
              {terms.rentAmount} {terms.currency}
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
              Starts
            </Text>

            <Text
              style={
                styles.value
              }
            >
              {terms.startDate}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text
          style={
            styles.label
          }
        >
          Invitation link
        </Text>

        <Text
          selectable
          style={
            styles.link
          }
        >
          {invitation.link}
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          Expires {formatDate(
            invitation.expiresAt,
          )}.
          The tenant must sign in to Dometra and complete the required profile before accepting.
        </Text>
      </Card>

      <PrimaryButton
        title="Share invitation"
        onPress={() =>
          void shareInvitation()
        }
      />

      <SecondaryButton
        title="Done"
        onPress={
          done
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
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
        16,

      fontWeight:
        '800',

      marginTop:
        4,
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

    link: {
      color:
        colors.primary,

      fontSize:
        13,

      lineHeight:
        19,

      marginTop:
        8,
    },
  });
