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

import * as ImagePicker
  from 'expo-image-picker';

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
  PropertyThumbnail,
} from '../components/PropertyThumbnail';

import {
  loadPropertyIcon,
  PropertyIcon,
  removePropertyIcon,
  setPropertyIcon,
} from '../services/propertyIconRepository';

import {
  colors,
  spacing,
} from '../theme';

export function PropertyIconScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const propertyId =
    route.params
      ?.propertyId as string;

  const propertyName =
    route.params
      ?.propertyName as
      | string
      | undefined;

  const propertyAddress =
    route.params
      ?.propertyAddress as
      | string
      | undefined;

  const [
    icon,
    setIcon,
  ] =
    useState<
      PropertyIcon | null
    >(null);

  const [
    selectedUri,
    setSelectedUri,
  ] =
    useState<
      string | undefined
    >(undefined);

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
          const result =
            await loadPropertyIcon(
              propertyId,
            );

          setIcon(
            result,
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Apartment image',

            error instanceof
            Error
              ? error.message
              : 'Unable to load apartment image.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },

      [
        propertyId,
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

  const chooseFromCamera =
    async () => {
      if (
        busy
      ) {
        return;
      }

      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Camera permission',

          'Camera access is required to take an apartment photo.',
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
                0.85,

              allowsEditing:
                true,

              aspect: [
                1,
                1,
              ],
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
        setSelectedUri(
          uri,
        );
      }
    };

  const chooseFromGallery =
    async () => {
      if (
        busy
      ) {
        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync(
            {
              mediaTypes: [
                'images',
              ],

              quality:
                0.85,

              allowsEditing:
                true,

              aspect: [
                1,
                1,
              ],

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
        setSelectedUri(
          uri,
        );
      }
    };

  const save =
    async () => {
      if (
        !selectedUri ||
        busy
      ) {
        return;
      }

      setBusy(
        true,
      );

      try {
        const result =
          await setPropertyIcon(
            propertyId,
            selectedUri,
          );

        setIcon(
          result,
        );

        setSelectedUri(
          undefined,
        );

        Alert.alert(
          'Saved',

          'Apartment image has been updated.',

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
            : 'Unable to update the apartment image.',
        );
      } finally {
        setBusy(
          false,
        );
      }
    };

  const useDefault =
    () => {
      if (
        busy
      ) {
        return;
      }

      if (
        !icon?.path
      ) {
        setSelectedUri(
          undefined,
        );

        return;
      }

      Alert.alert(
        'Use default icon?',

        'The custom apartment image will be removed and Dometra will show the default building icon.',

        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Use default',

            style:
              'destructive',

            onPress:
              async () => {
                setBusy(
                  true,
                );

                try {
                  await removePropertyIcon(
                    propertyId,
                  );

                  setIcon(
                    {
                      propertyId,
                    },
                  );

                  setSelectedUri(
                    undefined,
                  );

                  if (
                    navigation.canGoBack()
                  ) {
                    navigation.goBack();
                  }
                } catch (
                  error
                ) {
                  Alert.alert(
                    'Unable to remove image',

                    error instanceof
                    Error
                      ? error.message
                      : 'Unable to use the default icon.',
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

  const previewUri =
    selectedUri ??
    icon?.uri;

  return (
    <Screen>
      <Header
        title="Apartment image"
        subtitle={
          propertyName ??
          'Choose how this apartment appears'
        }
      />

      <Card>
        <View
          style={
            styles.previewRow
          }
        >
          <PropertyThumbnail
            uri={
              previewUri
            }
            size={
              118
            }
          />

          <View
            style={
              styles.previewText
            }
          >
            <Text
              style={
                styles.title
              }
            >
              {propertyName ??
                'Apartment'}
            </Text>

            {propertyAddress ? (
              <Text
                style={
                  styles.muted
                }
              >
                {
                  propertyAddress
                }
              </Text>
            ) : null}

            <Text
              style={
                styles.help
              }
            >
              This image is used as the apartment thumbnail on the landlord Home screen.
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text
          style={
            styles.title
          }
        >
          Choose image
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          Use a photo of the building, entrance or apartment. Dometra crops it to a square thumbnail.
        </Text>

        <View
          style={
            styles.actions
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
                void chooseFromCamera()
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
                void chooseFromGallery()
              }
            />
          </View>
        </View>

        {selectedUri ? (
          <View
            style={
              styles.saveTop
            }
          >
            <PrimaryButton
              title={
                busy
                  ? 'Saving...'
                  : 'Save image'
              }
              disabled={
                busy
              }
              onPress={() =>
                void save()
              }
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <Text
          style={
            styles.title
          }
        >
          Default icon
        </Text>

        <Text
          style={
            styles.muted
          }
        >
          If you do not set an image, Dometra automatically uses the default apartment icon.
        </Text>

        <View
          style={
            styles.defaultPreview
          }
        >
          <PropertyThumbnail
            size={
              72
            }
          />
        </View>

        {(icon?.path ||
          selectedUri) ? (
          <SecondaryButton
            title="Use default icon"
            onPress={
              useDefault
            }
          />
        ) : null}
      </Card>

      {loading ? (
        <Text
          style={
            styles.loading
          }
        >
          Loading...
        </Text>
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

    previewRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,
    },

    previewText: {
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

    help: {
      color:
        colors.muted,

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        spacing.sm,
    },

    actions: {
      flexDirection:
        'row',

      gap:
        spacing.sm,

      marginTop:
        spacing.md,
    },

    saveTop: {
      marginTop:
        spacing.md,
    },

    defaultPreview: {
      alignItems:
        'flex-start',

      marginTop:
        spacing.md,

      marginBottom:
        spacing.md,
    },

    loading: {
      color:
        colors.muted,

      fontSize:
        12,

      textAlign:
        'center',

      marginTop:
        spacing.sm,
    },
  });