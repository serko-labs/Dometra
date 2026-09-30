import React, {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  Card,
  Field,
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from '../components/ui';

import {
  getMyTenantProfile,
  saveMyTenantProfile,
} from '../services/tenantRepository';

import {
  TenantProfileInput,
} from '../types';

import {
  colors,
  radius,
  spacing,
} from '../theme';

type ScreenMode =
  'MANUAL' | 'SELF';

function isEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(
      value.trim(),
    );
}

export function TenantProfileScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const mode =
    (
      route.params?.mode ??
      'MANUAL'
    ) as ScreenMode;

  const propertyId =
    route.params
      ?.propertyId as
      | string
      | undefined;

  const inviteToken =
    route.params
      ?.inviteToken as
      | string
      | undefined;

  const [
    firstName,
    setFirstName,
  ] =
    useState('');

  const [
    lastName,
    setLastName,
  ] =
    useState('');

  const [
    phone,
    setPhone,
  ] =
    useState('');

  const [
    email,
    setEmail,
  ] =
    useState('');

  const [
    passportIdNumber,
    setPassportIdNumber,
  ] =
    useState('');

  const [
    passportPhotoUri,
    setPassportPhotoUri,
  ] =
    useState<
      string | undefined
    >();

  const [
    emergencyContact,
    setEmergencyContact,
  ] =
    useState('');

  const [
    notes,
    setNotes,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(
      mode === 'SELF',
    );

  useEffect(
    () => {
      if (
        mode !== 'SELF'
      ) {
        return;
      }

      let active =
        true;

      const load =
        async () => {
          try {
            const profile =
              await getMyTenantProfile();

            if (
              !active ||
              !profile
            ) {
              return;
            }

            setFirstName(
              profile.firstName,
            );

            setLastName(
              profile.lastName,
            );

            setPhone(
              profile.phone,
            );

            setEmail(
              profile.email,
            );

            setPassportIdNumber(
              profile.passportIdNumber ??
              '',
            );

            setPassportPhotoUri(
              profile.passportPhotoUri,
            );

            setEmergencyContact(
              profile.emergencyContact ??
              '',
            );

            setNotes(
              profile.notes ??
              '',
            );
          } catch (
            error
          ) {
            Alert.alert(
              'Unable to load profile',
              error instanceof Error
                ? error.message
                : 'Unknown error.',
            );
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
      mode,
    ],
  );

  const choosePassportPhoto =
    async () => {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              'images',
            ],

            allowsEditing:
              false,

            quality:
              0.85,

            selectionLimit:
              1,
          },
        );

      if (
        result.canceled
      ) {
        return;
      }

      const selected =
        result.assets[0];

      if (
        selected?.uri
      ) {
        setPassportPhotoUri(
          selected.uri,
        );
      }
    };

  const buildInput =
    (): TenantProfileInput => ({
      firstName:
        firstName.trim(),

      lastName:
        lastName.trim(),

      phone:
        phone.trim(),

      email:
        email
          .trim()
          .toLowerCase(),

      passportIdNumber:
        passportIdNumber.trim() ||
        undefined,

      passportPhotoUri,

      emergencyContact:
        emergencyContact.trim() ||
        undefined,

      notes:
        notes.trim() ||
        undefined,
    });

  const validate =
    () => {
      if (
        !firstName.trim()
      ) {
        throw new Error(
          'First name is required.',
        );
      }

      if (
        !lastName.trim()
      ) {
        throw new Error(
          'Last name is required.',
        );
      }

      if (
        !phone.trim()
      ) {
        throw new Error(
          'Phone is required.',
        );
      }

      if (
        !email.trim()
      ) {
        throw new Error(
          'Email is required.',
        );
      }

      if (
        !isEmail(
          email,
        )
      ) {
        throw new Error(
          'Enter a valid email address.',
        );
      }
    };

  const submit =
    async () => {
      try {
        validate();

        const input =
          buildInput();

        if (
          mode === 'MANUAL'
        ) {
          if (
            !propertyId
          ) {
            throw new Error(
              'Property is missing.',
            );
          }

          navigation.navigate(
            'TenancyTerms',
            {
              mode:
                'MANUAL',

              propertyId,

              tenantProfile:
                input,
            },
          );

          return;
        }

        setBusy(true);

        await saveMyTenantProfile(
          input,
        );

        if (
          inviteToken
        ) {
          navigation.popTo(
            'TenantInvitation',
            {
              token:
                inviteToken,
            },
          );

          return;
        }

        navigation.goBack();
      } catch (
        error
      ) {
        Alert.alert(
          'Tenant profile',
          error instanceof Error
            ? error.message
            : 'Unknown error.',
        );
      } finally {
        setBusy(false);
      }
    };

  if (
    loading
  ) {
    return (
      <Screen>
        <Header
          title="Tenant profile"
          subtitle="Loading profile..."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={
          mode === 'MANUAL'
            ? 'Tenant details'
            : 'Your tenant profile'
        }
        subtitle={
          mode === 'MANUAL'
            ? 'Enter the tenant information'
            : 'Complete your information before accepting an apartment invitation'
        }
      />

      <Field
        label="First name *"
        value={
          firstName
        }
        onChangeText={
          setFirstName
        }
        autoCapitalize="words"
        editable={
          !busy
        }
      />

      <Field
        label="Last name *"
        value={
          lastName
        }
        onChangeText={
          setLastName
        }
        autoCapitalize="words"
        editable={
          !busy
        }
      />

      <Field
        label="Phone *"
        value={
          phone
        }
        onChangeText={
          setPhone
        }
        keyboardType="phone-pad"
        placeholder="+380..."
        editable={
          !busy
        }
      />

      <Field
        label="Email *"
        value={
          email
        }
        onChangeText={
          setEmail
        }
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={
          false
        }
        editable={
          !busy
        }
      />

      <Field
        label="Passport / ID number (optional)"
        value={
          passportIdNumber
        }
        onChangeText={
          setPassportIdNumber
        }
        autoCapitalize="characters"
        editable={
          !busy
        }
      />

      <Card>
        <Text
          style={
            styles.cardTitle
          }
        >
          Passport photo
        </Text>

        <Text
          style={
            styles.hint
          }
        >
          Optional. Stored privately in Dometra.
        </Text>

        {passportPhotoUri ? (
          <Image
            source={{
              uri:
                passportPhotoUri,
            }}
            style={
              styles.documentPhoto
            }
            resizeMode="cover"
          />
        ) : null}

        <View
          style={
            styles.buttonTop
          }
        >
          <SecondaryButton
            title={
              passportPhotoUri
                ? 'Change passport photo'
                : 'Choose passport photo'
            }
            onPress={() =>
              void choosePassportPhoto()
            }
          />
        </View>
      </Card>

      <Field
        label="Emergency contact (optional)"
        value={
          emergencyContact
        }
        onChangeText={
          setEmergencyContact
        }
        placeholder="Name and phone number"
        editable={
          !busy
        }
      />

      <Field
        label="Notes (optional)"
        value={
          notes
        }
        onChangeText={
          setNotes
        }
        multiline
        numberOfLines={
          4
        }
        textAlignVertical="top"
        editable={
          !busy
        }
      />

      <Text
        style={
          styles.privacy
        }
      >
        Passport information is optional and should only be stored when it is needed for the rental relationship.
      </Text>

      <PrimaryButton
        title={
          busy
            ? 'Saving...'
            : mode === 'MANUAL'
              ? 'Continue'
              : 'Save profile'
        }
        disabled={
          busy
        }
        onPress={() =>
          void submit()
        }
      />
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    cardTitle: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    hint: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    documentPhoto: {
      width:
        '100%',

      height:
        180,

      borderRadius:
        radius.sm,

      marginTop:
        spacing.md,

      backgroundColor:
        colors.border,
    },

    buttonTop: {
      marginTop:
        spacing.md,
    },

    privacy: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,
    },
  });
