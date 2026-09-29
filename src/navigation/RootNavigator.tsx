import React from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  useTranslation,
} from 'react-i18next';

import {
  useApp,
} from '../context/AppContext';

import {
  colors,
} from '../theme';

import {
  PrimaryButton,
  Screen,
} from '../components/ui';

import {
  AuthScreen,
} from '../screens/AuthScreen';

import {
  DashboardScreen,
} from '../screens/DashboardScreen';

import {
  PropertiesScreen,
} from '../screens/PropertiesScreen';

import {
  PaymentsScreen,
} from '../screens/PaymentsScreen';

import {
  SettingsScreen,
} from '../screens/SettingsScreen';

import {
  TenantHomeScreen,
} from '../screens/TenantHomeScreen';

import {
  ReadingsScreen,
} from '../screens/ReadingsScreen';

import {
  InvoicesScreen,
} from '../screens/InvoicesScreen';

import {
  PropertyDetailsScreen,
} from '../screens/PropertyDetailsScreen';

import {
  AddPropertyScreen,
} from '../screens/AddPropertyScreen';

import {
  AddMeterScreen,
} from '../screens/AddMeterScreen';

import {
  MeterReadingScreen,
} from '../screens/MeterReadingScreen';

import {
  InvoiceDetailsScreen,
} from '../screens/InvoiceDetailsScreen';

import {
  AddPaymentScreen,
} from '../screens/AddPaymentScreen';

import {
  LanguageScreen,
} from '../screens/LanguageScreen';

const AuthStack =
  createNativeStackNavigator();

const MainStack =
  createNativeStackNavigator();

const Tab =
  createBottomTabNavigator();

const icons: Record<
  string,
  string
> = {
  Dashboard: '⌂',
  Properties: '▦',
  Payments: '$',
  Settings: '⚙',

  Home: '⌂',
  Readings: '⌁',
  Invoices: '≣',
};

function TabIcon({
  routeName,
  focused,
}: {
  routeName: string;
  focused: boolean;
}) {
  return (
    <Text
      style={{
        fontSize: 20,

        opacity: focused
          ? 1
          : 0.45,
      }}
    >
      {icons[routeName] ?? '•'}
    </Text>
  );
}

/*
 * LANDLORD
 */

function LandlordTabs() {
  const {
    t,
  } =
    useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }) => ({
        headerShown:
          false,

        tabBarActiveTintColor:
          colors.primary,

        tabBarInactiveTintColor:
          colors.muted,

        tabBarStyle:
          styles.tabBar,

        tabBarIcon: ({
          focused,
        }) => (
          <TabIcon
            routeName={
              route.name
            }
            focused={
              focused
            }
          />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={
          DashboardScreen
        }
        options={{
          title:
            t(
              'dashboard',
            ),
        }}
      />

      <Tab.Screen
        name="Properties"
        component={
          PropertiesScreen
        }
        options={{
          title:
            t(
              'properties',
            ),
        }}
      />

      <Tab.Screen
        name="Payments"
        component={
          PaymentsScreen
        }
        options={{
          title:
            t(
              'payments',
            ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={
          SettingsScreen
        }
        options={{
          title:
            t(
              'settings',
            ),
        }}
      />
    </Tab.Navigator>
  );
}

/*
 * TENANT
 */

function TenantTabs() {
  const {
    t,
  } =
    useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({
        route,
      }) => ({
        headerShown:
          false,

        tabBarActiveTintColor:
          colors.primary,

        tabBarInactiveTintColor:
          colors.muted,

        tabBarStyle:
          styles.tabBar,

        tabBarIcon: ({
          focused,
        }) => (
          <TabIcon
            routeName={
              route.name
            }
            focused={
              focused
            }
          />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={
          TenantHomeScreen
        }
        options={{
          title:
            t('home'),
        }}
      />

      <Tab.Screen
        name="Readings"
        component={
          ReadingsScreen
        }
        options={{
          title:
            t(
              'readings',
            ),
        }}
      />

      <Tab.Screen
        name="Invoices"
        component={
          InvoicesScreen
        }
        options={{
          title:
            t(
              'invoices',
            ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={
          SettingsScreen
        }
        options={{
          title:
            t(
              'settings',
            ),
        }}
      />
    </Tab.Navigator>
  );
}

/*
 * Select landlord/tenant mode.
 */

function MainTabs() {
  const {
    state,
  } =
    useApp();

  if (
    state.settings
      .activeMode ===
    'TENANT'
  ) {
    return (
      <TenantTabs />
    );
  }

  return (
    <LandlordTabs />
  );
}

/*
 * Unauthenticated navigation.
 *
 * This navigator exists ONLY
 * when session === null.
 */

function AuthNavigator() {
  return (
    <NavigationContainer
      key="auth-navigation"
    >
      <AuthStack.Navigator>
        <AuthStack.Screen
          name="Auth"
          component={
            AuthScreen
          }
          options={{
            headerShown:
              false,
          }}
        />
      </AuthStack.Navigator>
    </NavigationContainer>
  );
}

/*
 * Authenticated navigation.
 *
 * AuthScreen does not exist anywhere
 * in this navigation tree.
 */

function AuthenticatedNavigator() {
  return (
    <NavigationContainer
      key="main-navigation"
    >
      <MainStack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShadowVisible:
            false,

          headerBackTitle:
            'Back',
        }}
      >
        <MainStack.Screen
          name="Main"
          component={
            MainTabs
          }
          options={{
            headerShown:
              false,
          }}
        />

        <MainStack.Screen
          name="PropertyDetails"
          component={
            PropertyDetailsScreen
          }
          options={{
            title: '',
          }}
        />

        <MainStack.Screen
          name="AddProperty"
          component={
            AddPropertyScreen
          }
          options={{
            title: '',
          }}
        />

        <MainStack.Screen
          name="AddMeter"
          component={
            AddMeterScreen
          }
          options={{
            title: '',
          }}
        />

        <MainStack.Screen
          name="MeterReading"
          component={
            MeterReadingScreen
          }
          options={{
            title: '',
          }}
        />

        <MainStack.Screen
          name="InvoiceDetails"
          component={
            InvoiceDetailsScreen
          }
          options={{
            title: '',
          }}
        />

        <MainStack.Screen
          name="AddPayment"
          component={
            AddPaymentScreen
          }
          options={{
            title: '',
          }}
        />

        <MainStack.Screen
          name="Language"
          component={
            LanguageScreen
          }
          options={{
            title: '',
          }}
        />
      </MainStack.Navigator>
    </NavigationContainer>
  );
}

/*
 * ROOT
 */

export function RootNavigator() {
  const {
    hydrated,
    session,
    authStatus,
    authError,
    refreshAuth,
  } =
    useApp();

  console.log(
    '[Dometra Navigation]',
    {
      hydrated,
      authStatus,
      hasSession:
        Boolean(session),
      email:
        session?.user.email ??
        null,
    },
  );

  /*
   * Initial app startup.
   *
   * We do NOT show login until
   * Supabase has checked whether
   * a stored session exists.
   */

  if (
    !hydrated ||
    authStatus ===
      'loading'
  ) {
    return (
      <Screen
        scroll={false}
        style={
          styles.loader
        }
      >
        <ActivityIndicator
          size="large"
          color={
            colors.primary
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Connecting to
          Dometra...
        </Text>
      </Screen>
    );
  }

  /*
   * Supabase configuration missing.
   *
   * Dometra must NOT work without
   * Supabase.
   */

  if (
    authStatus ===
    'configuration-error'
  ) {
    return (
      <Screen
        scroll={false}
        style={
          styles.blocker
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Configuration error
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          Supabase is not
          configured. Dometra
          cannot be used without
          Supabase.
        </Text>

        {authError ? (
          <Text
            style={
              styles.errorTechnical
            }
          >
            {authError}
          </Text>
        ) : null}
      </Screen>
    );
  }

  /*
   * Network/session validation failed.
   */

  if (
    authStatus ===
    'connection-error'
  ) {
    return (
      <Screen
        scroll={false}
        style={
          styles.blocker
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Unable to connect
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          Dometra could not
          connect to Supabase.
        </Text>

        {authError ? (
          <Text
            style={
              styles.errorTechnical
            }
          >
            {authError}
          </Text>
        ) : null}

        <PrimaryButton
          title="Try again"
          onPress={() => {
            void refreshAuth();
          }}
        />
      </Screen>
    );
  }

  /*
   * NO SESSION
   *
   * Only Login / Register exists.
   */

  if (!session) {
    return (
      <AuthNavigator />
    );
  }

  /*
   * REAL SUPABASE SESSION
   *
   * Auth navigator is now completely
   * unmounted and Main navigator
   * starts from Main.
   */

  return (
    <AuthenticatedNavigator />
  );
}

const styles =
  StyleSheet.create({
    tabBar: {
      height: 66,

      paddingTop: 7,

      paddingBottom: 8,

      borderTopColor:
        colors.border,
    },

    loader: {
      justifyContent:
        'center',

      alignItems:
        'center',

      gap: 14,
    },

    loadingText: {
      color:
        colors.muted,

      fontSize: 14,

      textAlign:
        'center',
    },

    blocker: {
      justifyContent:
        'center',

      gap: 18,
    },

    errorTitle: {
      color:
        colors.text,

      fontSize: 28,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    errorText: {
      color:
        colors.muted,

      fontSize: 16,

      lineHeight: 23,

      textAlign:
        'center',
    },

    errorTechnical: {
      color:
        colors.muted,

      fontSize: 12,

      lineHeight: 18,

      textAlign:
        'center',
    },
  });