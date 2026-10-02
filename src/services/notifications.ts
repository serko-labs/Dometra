import Constants from 'expo-constants';

import * as Notifications from 'expo-notifications';

import {
  Platform,
} from 'react-native';

import {
  supabase,
} from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification:
    async () => ({
      shouldShowBanner:
        true,

      shouldShowList:
        true,

      shouldPlaySound:
        true,

      shouldSetBadge:
        false,
    }),
});

function requireSupabase() {
  if (
    !supabase
  ) {
    throw new Error(
      'Supabase is not configured.',
    );
  }

  return supabase;
}

function getProjectId():
string {
  const projectId =
    Constants.expoConfig
      ?.extra
      ?.eas
      ?.projectId ??
    Constants.easConfig
      ?.projectId;

  if (
    !projectId
  ) {
    throw new Error(
      'Expo EAS projectId is not configured.',
    );
  }

  return projectId;
}

function platformName():
  | 'IOS'
  | 'ANDROID'
  | 'WEB' {
  if (
    Platform.OS ===
    'ios'
  ) {
    return 'IOS';
  }

  if (
    Platform.OS ===
    'android'
  ) {
    return 'ANDROID';
  }

  return 'WEB';
}

export async function requestNotificationPermission() {
  const current =
    await Notifications
      .getPermissionsAsync();

  if (
    current.granted
  ) {
    return true;
  }

  const result =
    await Notifications
      .requestPermissionsAsync();

  return result.granted;
}

export async function registerPushNotificationsForCurrentUser() {
  if (
    Platform.OS ===
    'web'
  ) {
    return false;
  }

  const granted =
    await requestNotificationPermission();

  if (
    !granted
  ) {
    return false;
  }

  const projectId =
    getProjectId();

  const expoPushToken =
    (
      await Notifications
        .getExpoPushTokenAsync({
          projectId,
        })
    ).data;

  const client =
    requireSupabase();

  const {
    data:
      userData,

    error:
      userError,
  } =
    await client.auth
      .getUser();

  if (
    userError
  ) {
    throw userError;
  }

  const userId =
    userData.user?.id;

  if (
    !userId
  ) {
    throw new Error(
      'Authentication is required to register push notifications.',
    );
  }

  const {
    error,
  } =
    await client
      .from(
        'device_push_tokens',
      )
      .upsert(
        {
          user_id:
            userId,

          platform:
            platformName(),

          token:
            expoPushToken,

          enabled:
            true,

          last_seen_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            'token',
        },
      );

  if (
    error
  ) {
    throw error;
  }

  return true;
}

export async function disableCurrentExpoPushToken() {
  if (
    Platform.OS ===
    'web'
  ) {
    return;
  }

  const client =
    requireSupabase();

  const projectId =
    getProjectId();

  const token =
    (
      await Notifications
        .getExpoPushTokenAsync({
          projectId,
        })
    ).data;

  const {
    error,
  } =
    await client
      .from(
        'device_push_tokens',
      )
      .update({
        enabled:
          false,

        last_seen_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'token',
        token,
      );

  if (
    error
  ) {
    throw error;
  }
}

export async function scheduleTestReminder() {
  const granted =
    await requestNotificationPermission();

  if (
    !granted
  ) {
    return false;
  }

  await Notifications
    .scheduleNotificationAsync({
      content: {
        title:
          'Dometra',

        body:
          'Нагадування: перевірте оплату оренди та показники лічильників.',
      },

      trigger: {
        type:
          Notifications
            .SchedulableTriggerInputTypes
            .TIME_INTERVAL,

        seconds:
          3,
      },
    });

  return true;
}