import React from 'react';

import {
  Pressable,
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
  Screen,
} from '../components/ui';

import {
  colors,
  spacing,
} from '../theme';

export function AddTenantMethodScreen() {
  const navigation =
    useNavigation<any>();

  const route =
    useRoute<any>();

  const propertyId =
    route.params
      ?.propertyId as string;

  return (
    <Screen>
      <Header
        title="Add tenant"
        subtitle="Choose how you want to add a tenant"
      />

      <Pressable
        onPress={() =>
          navigation.navigate(
            'TenantProfile',
            {
              mode:
                'MANUAL',

              propertyId,
            },
          )
        }
      >
        <Card
          style={
            styles.optionCard
          }
        >
          <View
            style={
              styles.iconWrap
            }
          >
            <Text
              style={
                styles.icon
              }
            >
              👤
            </Text>
          </View>

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
              Add manually
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Tenant does not use Dometra yet.
              Add their contact details and rental terms yourself.
            </Text>
          </View>

          <Text
            style={
              styles.chevron
            }
          >
            ›
          </Text>
        </Card>
      </Pressable>

      <Pressable
        onPress={() =>
          navigation.navigate(
            'TenancyTerms',
            {
              mode:
                'INVITE',

              propertyId,
            },
          )
        }
      >
        <Card
          style={
            styles.optionCard
          }
        >
          <View
            style={
              styles.iconWrap
            }
          >
            <Text
              style={
                styles.icon
              }
            >
              ✉️
            </Text>
          </View>

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
              Invite Dometra user
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Configure the rental terms, generate a secure invitation,
              then share it through your preferred messenger.
            </Text>
          </View>

          <Text
            style={
              styles.chevron
            }
          >
            ›
          </Text>
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    optionCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        spacing.md,

      minHeight:
        112,
    },

    iconWrap: {
      width:
        48,

      height:
        48,

      borderRadius:
        24,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    icon: {
      fontSize:
        22,
    },

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

    subtitle: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        5,
    },

    chevron: {
      color:
        colors.muted,

      fontSize:
        28,

      fontWeight:
        '300',
    },
  });
