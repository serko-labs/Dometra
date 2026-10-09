import React, {
  useCallback,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';

import {
  loadUnreadNotificationCount,
} from '../services/notificationCenterRepository';

import {
  colors,
} from '../theme';

export function NotificationBell() {
  const navigation =
    useNavigation<any>();

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(
      0,
    );

  const reload =
    useCallback(
      async () => {
        try {
          setUnreadCount(
            await loadUnreadNotificationCount(),
          );
        } catch (
          error
        ) {
          console.warn(
            '[Dometra] Unable to load notification count:',
            error,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void reload();
      },

      [
        reload,
      ],
    ),
  );

  return (
    <Pressable
      onPress={() =>
        navigation.navigate(
          'Notifications',
        )
      }
      hitSlop={
        10
      }
      style={({
        pressed,
      }) => [
        styles.button,

        pressed &&
          styles.pressed,
      ]}
    >
      <Text
        style={
          styles.icon
        }
      >
        ♢
      </Text>

      {unreadCount >
      0 ? (
        <View
          style={
            styles.badge
          }
        >
          <Text
            style={
              styles.badgeText
            }
          >
            {unreadCount >
            99
              ? '99+'
              : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    button: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        '#FFFFFF',
    },

    pressed: {
      opacity:
        0.65,
    },

    icon: {
      color:
        colors.text,

      fontSize:
        23,

      lineHeight:
        26,

      fontWeight:
        '800',
    },

    badge: {
      position:
        'absolute',

      top:
        -4,

      right:
        -5,

      minWidth:
        20,

      height:
        20,

      paddingHorizontal:
        5,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#DC2626',

      borderWidth:
        2,

      borderColor:
        '#FFFFFF',
    },

    badgeText: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      lineHeight:
        11,

      fontWeight:
        '900',
    },
  });