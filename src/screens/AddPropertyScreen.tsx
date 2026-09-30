import React, {
  useState,
} from 'react';

import {
  Alert,
  StyleSheet,
  Text,
} from 'react-native';

import {
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import {
  useTranslation,
} from 'react-i18next';

import {
  Field,
  Header,
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  useApp,
} from '../context/AppContext';

import {
  colors,
} from '../theme';

export function AddPropertyScreen() {
  const {
    t,
  } =
    useTranslation();

  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const {
    state,
    addProperty,
    editProperty,
  } =
    useApp();

  const propertyId =
    route.params
      ?.propertyId as
      | string
      | undefined;

  const property =
    propertyId
      ? state.properties.find(
          (
            item,
          ) =>
            item.id ===
            propertyId,
        )
      : undefined;

  const isEditing =
    Boolean(
      property,
    );

  const [
    city,
    setCity,
  ] =
    useState(
      property?.city ??
        '',
    );

  const [
    address,
    setAddress,
  ] =
    useState(
      property?.address ??
        '',
    );

  const [
    name,
    setName,
  ] =
    useState(
      property?.name ===
        property?.address
        ? ''
        : property?.name ??
            '',
    );

  const [
    area,
    setArea,
  ] =
    useState(
      property &&
        property.areaM2 >
          0
        ? String(
            property.areaM2,
          )
        : '',
    );

  const submit = () => {
    const cleanCity =
      city.trim();

    const cleanAddress =
      address.trim();

    const cleanName =
      name.trim();

    if (!cleanCity) {
      Alert.alert(
        'Dometra',
        'City is required.',
      );

      return;
    }

    if (!cleanAddress) {
      Alert.alert(
        'Dometra',
        'Address is required.',
      );

      return;
    }

    const areaValue =
      area.trim()
        ? Number(
            area.replace(
              ',',
              '.',
            ),
          )
        : undefined;

    if (
      areaValue !==
        undefined &&
      (
        !Number.isFinite(
          areaValue,
        ) ||
        areaValue <= 0
      )
    ) {
      Alert.alert(
        'Dometra',
        'Square must be greater than 0.',
      );

      return;
    }

    const input = {
      city:
        cleanCity,

      address:
        cleanAddress,

      name:
        cleanName ||
        undefined,

      areaM2:
        areaValue,
    };

    if (
      isEditing &&
      property
    ) {
      editProperty(
        property.id,
        input,
      );

      navigation.goBack();

      return;
    }

    const created =
      addProperty(
        input,
      );

    navigation.replace(
      'PropertyDetails',
      {
        propertyId:
          created.id,
      },
    );
  };

  return (
    <Screen>
      <Header
        title={
          isEditing
            ? 'Edit apartment'
            : t(
                'addProperty',
              )
        }
        subtitle={
          isEditing
            ? 'Update apartment information'
            : 'Add the basic apartment information'
        }
      />

      <Field
        label="City *"
        value={
          city
        }
        onChangeText={
          setCity
        }
        placeholder="Chernivtsi"
        autoCapitalize="words"
      />

      <Field
        label="Address *"
        value={
          address
        }
        onChangeText={
          setAddress
        }
        placeholder="Holovna St, 100, Apt 12"
      />

      <Field
        label="Name (optional)"
        value={
          name
        }
        onChangeText={
          setName
        }
        placeholder="Central apartment"
      />

      <Field
        label="Square, m² (optional)"
        value={
          area
        }
        onChangeText={
          setArea
        }
        placeholder="54.5"
        keyboardType="decimal-pad"
      />

      <Text
        style={
          styles.hint
        }
      >
        Rent, tenant and payment
        conditions can be
        configured separately.
      </Text>

      <PrimaryButton
        title={
          isEditing
            ? 'Save'
            : t(
                'create',
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
    hint: {
      color:
        colors.muted,

      fontSize:
        13,

      lineHeight:
        19,
    },
  });