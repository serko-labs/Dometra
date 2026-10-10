import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useNavigation,
} from '@react-navigation/native';

import {
  useQuery,
} from '@tanstack/react-query';

import {
  queryKeys,
} from '../lib/queryClient';

import {
  DometraNotification,
  loadNotifications,
} from '../services/notificationCenterRepository';


export function NotificationBell() {
  const navigation =
    useNavigation<any>();

  const {
    data:
      notifications = [],
  } =
    useQuery<DometraNotification[]>({
      queryKey:
        queryKeys.notifications,

      /*
       * IMPORTANT:
       *
       * Do not pass loadNotifications directly.
       *
       * React Query calls queryFn(context), while
       * loadNotifications expects:
       *
       *   loadNotifications(limit?: number)
       */
      queryFn:
        () =>
          loadNotifications(),

      staleTime:
        30_000,

      refetchInterval:
        60_000,

      refetchOnMount:
        false,

      refetchOnWindowFocus:
        false,
    });


  const unreadCount =
    notifications.filter(
      notification =>
        !notification.readAt,
    ).length;


  return (
    <Pressable
      onPress={() =>
        navigation.navigate(
          'Notifications',
        )
      }
      style={({
        pressed,
      }) => [
        styles.button,

        pressed &&
          styles.pressed,
      ]}
      hitSlop={
        10
      }
    >
      <Text
        style={
          styles.icon
        }
      >
        🔔
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

      backgroundColor:
        '#F1F5F9',
    },

    pressed: {
      opacity:
        0.65,
    },

    icon: {
      fontSize:
        20,
    },

    badge: {
      position:
        'absolute',

      right:
        -4,

      top:
        -4,

      minWidth:
        18,

      height:
        18,

      paddingHorizontal:
        4,

      borderRadius:
        9,

      backgroundColor:
        '#DC2626',

      alignItems:
        'center',

      justifyContent:
        'center',
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