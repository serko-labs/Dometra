import React, {
  useCallback,
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
  Card,
  Field,
  Header,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from '../components/ui';

import {
  billingMonthLabel,
  currentBillingPeriod,
  loadVariableExpense,
  saveVariableExpense,
  VariableExpense,
} from '../services/billingRepository';

import {
  colors,
  radius,
  spacing,
} from '../theme';

export function VariableExpenseScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const tenancyId =
    route.params
      ?.tenancyId as string;

  const propertyServiceId =
    route.params
      ?.propertyServiceId as string;

  const serviceName =
    route.params
      ?.serviceName as
      | string
      | undefined;

  const currency =
    route.params
      ?.currency as
      | string
      | undefined;

  const billingPeriod =
    (
      route.params
        ?.billingPeriod as
        | string
        | undefined
    ) ??
    currentBillingPeriod();

  const [
    existing,
    setExisting,
  ] =
    useState<
      VariableExpense | null
    >(null);

  const [
    amount,
    setAmount,
  ] =
    useState(
      '',
    );

  const [
    note,
    setNote,
  ] =
    useState(
      '',
    );

  const [
    newPhotoUri,
    setNewPhotoUri,
  ] =
    useState<
      string | undefined
    >(undefined);

  const [
    removeExistingPhoto,
    setRemoveExistingPhoto,
  ] =
    useState(
      false,
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
          const expense =
            await loadVariableExpense(
              tenancyId,
              propertyServiceId,
              billingPeriod,
            );

          setExisting(
            expense,
          );

          setAmount(
            expense
              ? String(
                  expense.amount,
                )
              : '',
          );

          setNote(
            expense?.note ??
            '',
          );

          setNewPhotoUri(
            undefined,
          );

          setRemoveExistingPhoto(
            false,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Variable expense',

            error instanceof
            Error
              ? error.message
              : 'Unable to load this expense.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        tenancyId,
        propertyServiceId,
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

  const takePhoto =
    async () => {
      if (
        busy
      ) {
        return;
      }

      try {
        const permission =
          await ImagePicker
            .requestCameraPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            'Camera permission',
            'Camera access is required to take a proof photo.',
          );

          return;
        }

        const result =
          await ImagePicker
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
          uri
        ) {
          setNewPhotoUri(
            uri,
          );

          setRemoveExistingPhoto(
            false,
          );
        }
      } catch (
        error
      ) {
        Alert.alert(
          'Photo',

          error instanceof
          Error
            ? error.message
            : 'Unable to take a photo.',
        );
      }
    };

  const choosePhoto =
    async () => {
      if (
        busy
      ) {
        return;
      }

      try {
        const result =
          await ImagePicker
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
          uri
        ) {
          setNewPhotoUri(
            uri,
          );

          setRemoveExistingPhoto(
            false,
          );
        }
      } catch (
        error
      ) {
        Alert.alert(
          'Photo',

          error instanceof
          Error
            ? error.message
            : 'Unable to select a photo.',
        );
      }
    };

  const parsedAmount =
    Number(
      amount
        .trim()
        .replace(
          ',',
          '.',
        ),
    );

  const valid =
    amount.trim() !==
      '' &&

    Number.isFinite(
      parsedAmount,
    ) &&

    parsedAmount >=
      0;

  const displayedPhoto =
    newPhotoUri ??
    (
      removeExistingPhoto
        ? undefined
        : existing?.photoUri
    );

  const save =
    async () => {
      if (
        busy ||
        !valid
      ) {
        return;
      }

      setBusy(
        true,
      );

      try {
        await saveVariableExpense(
          {
            tenancyId,

            propertyServiceId,

            billingPeriod,

            amount:
              parsedAmount,

            note,

            photoUri:
              newPhotoUri,

            existingPhotoPath:
              existing?.photoPath,

            removeExistingPhoto,
          },
        );

        Alert.alert(
          'Saved',

          'The monthly variable expense has been saved.',

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
          'Unable to save',

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

  return (
    <Screen>
      <Header
        title={
          serviceName ??
          'Variable expense'
        }
        subtitle={
          billingMonthLabel(
            billingPeriod,
          )
        }
      />

      <Card>
        <Text
          style={
            styles.title
          }
        >
          Monthly expense
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          Either the landlord or the linked tenant may enter this amount. A bill or proof photo is optional.
        </Text>
      </Card>

      <Card>
        <Field
          label={
            `Amount${
              currency
                ? ` (${currency})`
                : ''
            } *`
          }
          value={
            amount
          }
          onChangeText={
            setAmount
          }
          keyboardType="decimal-pad"
          placeholder="0"
          editable={
            !busy &&
            !loading
          }
        />

        <Field
          label="Note"
          value={
            note
          }
          onChangeText={
            setNote
          }
          placeholder="Optional description"
          editable={
            !busy &&
            !loading
          }
          multiline
        />
      </Card>

      <Card>
        <Text
          style={
            styles.title
          }
        >
          Bill / proof photo
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          Optional. You can take a photo of the bill or select an existing image.
        </Text>

        {displayedPhoto ? (
          <Image
            source={{
              uri:
                displayedPhoto,
            }}
            style={
              styles.photo
            }
            resizeMode="cover"
          />
        ) : (
          <View
            style={
              styles.emptyPhoto
            }
          >
            <Text
              style={
                styles.emptyPhotoIcon
              }
            >
              ▧
            </Text>

            <Text
              style={
                styles.emptyPhotoText
              }
            >
              No photo attached
            </Text>
          </View>
        )}

        <View
          style={
            styles.photoActions
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <SecondaryButton
              title={
                displayedPhoto
                  ? 'Retake photo'
                  : 'Take photo'
              }
              onPress={() =>
                void takePhoto()
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
                void choosePhoto()
              }
            />
          </View>
        </View>

        {displayedPhoto ? (
          <Pressable
            onPress={() => {
              if (
                busy
              ) {
                return;
              }

              setNewPhotoUri(
                undefined,
              );

              setRemoveExistingPhoto(
                true,
              );
            }}
          >
            <Text
              style={
                styles.removePhoto
              }
            >
              Remove photo
            </Text>
          </Pressable>
        ) : null}
      </Card>

      <PrimaryButton
        title={
          busy
            ? 'Saving...'

            : existing
              ? 'Update expense'

              : 'Save expense'
        }
        disabled={
          busy ||
          loading ||
          !valid
        }
        onPress={() =>
          void save()
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

    photo: {
      width:
        '100%',

      height:
        220,

      borderRadius:
        radius.sm,

      marginTop:
        spacing.md,

      marginBottom:
        spacing.md,

      backgroundColor:
        colors.border,
    },

    emptyPhoto: {
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

      marginTop:
        spacing.md,

      marginBottom:
        spacing.md,
    },

    emptyPhotoIcon: {
      color:
        colors.muted,

      fontSize:
        30,
    },

    emptyPhotoText: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    photoActions: {
      flexDirection:
        'row',

      gap:
        spacing.sm,
    },

    removePhoto: {
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