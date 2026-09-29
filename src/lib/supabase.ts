import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createClient,
} from '@supabase/supabase-js';

import {
  AppState as ReactNativeAppState,
  Platform,
} from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured =
  Boolean(
    supabaseUrl &&
      supabasePublishableKey,
  );

if (__DEV__) {
  console.log(
    '[Dometra] Supabase URL configured:',
    Boolean(supabaseUrl),
  );

  console.log(
    '[Dometra] Supabase key configured:',
    Boolean(
      supabasePublishableKey,
    ),
  );
}

export const supabase =
  isSupabaseConfigured
    ? createClient(
        supabaseUrl!,
        supabasePublishableKey!,
        {
          auth: {
            storage:
              AsyncStorage,

            autoRefreshToken:
              true,

            persistSession:
              true,

            detectSessionInUrl:
              false,
          },
        },
      )
    : null;

if (
  supabase &&
  Platform.OS !== 'web'
) {
  ReactNativeAppState.addEventListener(
    'change',
    (state) => {
      if (
        state === 'active'
      ) {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    },
  );
}