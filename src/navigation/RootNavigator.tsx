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
  TenantApartmentScreen,
} from '../screens/TenantApartmentScreen';

import {
  TenantStatisticsScreen,
} from '../screens/TenantStatisticsScreen';

import {
  TenantCheckoutScreen,
} from '../screens/TenantCheckoutScreen';

import {
  ReadingsScreen,
} from '../screens/ReadingsScreen';

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

import {
  AddTenantMethodScreen,
} from '../screens/AddTenantMethodScreen';

import {
  TenantProfileScreen,
} from '../screens/TenantProfileScreen';

import {
  TenantDetailsScreen,
} from '../screens/TenantDetailsScreen';

import {
  CheckoutTenantScreen,
} from '../screens/CheckoutTenantScreen';

import {
  TenancyTermsScreen,
} from '../screens/TenancyTermsScreen';

import {
  InviteTenantScreen,
} from '../screens/InviteTenantScreen';

import {
  TenantInvitationScreen,
} from '../screens/TenantInvitationScreen';

const Stack =
  createNativeStackNavigator();

const Tab =
  createBottomTabNavigator();

const icons:
  Record<
    string,
    string
  > = {
  Dashboard:
    '⌂',

  Properties:
    '▦',

  Payments:
    '$',

  Settings:
    '⚙',

  Home:
    '⌂',

  Statistics:
    '▥',
};

const linking = {
  prefixes: [
    'dometra://',
  ],

  config: {
    screens: {
      TenantInvitation:
        'invite/:token',
    },
  },
};

function TabIcon({
  routeName,
  focused,
}: {
  routeName:
    string;

  focused:
    boolean;
}) {
  return (
    <Text
      style={{
        fontSize:
          20,

        opacity:
          focused
            ? 1
            : 0.45,
      }}
    >
      {icons[
        routeName
      ] ?? '•'}
    </Text>
  );
}

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
            t(
              'home',
            ),
        }}
      />

      <Tab.Screen
        name="Statistics"
        component={
          TenantStatisticsScreen
        }
        options={{
          title:
            t(
              'statistics',

              {
                defaultValue:
                  'Statistics',
              },
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

function MainTabs() {
  const {
    state,
  } =
    useApp();

  return state.settings.activeMode ===
    'LANDLORD'
    ? <LandlordTabs />
    : <TenantTabs />;
}

export function RootNavigator() {
  const {
    hydrated,
    session,
    authStatus,
  } =
    useApp();

  if (
    !hydrated ||
    authStatus ===
      'loading'
  ) {
    return (
      <Screen
        scroll={
          false
        }
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
      </Screen>
    );
  }

  return (
    <NavigationContainer
      linking={
        linking
      }
    >
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible:
            false,

          headerBackTitle:
            'Back',
        }}
      >
        {!session ? (
          <Stack.Screen
            name="Auth"
            component={
              AuthScreen
            }
            options={{
              headerShown:
                false,
            }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={
                MainTabs
              }
              options={{
                headerShown:
                  false,
              }}
            />

            <Stack.Screen
              name="TenantApartment"
              component={
                TenantApartmentScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="Readings"
              component={
                ReadingsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="TenantCheckout"
              component={
                TenantCheckoutScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="PropertyDetails"
              component={
                PropertyDetailsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="TenantDetails"
              component={
                TenantDetailsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="CheckoutTenant"
              component={
                CheckoutTenantScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="AddProperty"
              component={
                AddPropertyScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="AddMeter"
              component={
                AddMeterScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="MeterReading"
              component={
                MeterReadingScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="AddTenantMethod"
              component={
                AddTenantMethodScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="TenantProfile"
              component={
                TenantProfileScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="TenancyTerms"
              component={
                TenancyTermsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="InviteTenant"
              component={
                InviteTenantScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="InvoiceDetails"
              component={
                InvoiceDetailsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="AddPayment"
              component={
                AddPaymentScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="Language"
              component={
                LanguageScreen
              }
              options={{
                title:
                  '',
              }}
            />
          </>
        )}

        <Stack.Screen
          name="TenantInvitation"
          component={
            TenantInvitationScreen
          }
          options={{
            title:
              '',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles =
  StyleSheet.create({
    tabBar: {
      height:
        66,

      paddingTop:
        7,

      paddingBottom:
        8,

      borderTopColor:
        colors.border,
    },

    loader: {
      justifyContent:
        'center',

      alignItems:
        'center',
    },
  });