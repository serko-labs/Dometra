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
  LandlordStatisticsScreen,
} from '../screens/LandlordStatisticsScreen';

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
  TenantBillingScreen,
} from '../screens/TenantBillingScreen';

import {
  BillingHistoryScreen,
} from '../screens/BillingHistoryScreen';

import {
  PreviousRentalsScreen,
} from '../screens/PreviousRentalsScreen';

import {
  PreviousRentalDetailsScreen,
} from '../screens/PreviousRentalDetailsScreen';

import {
  NotificationsScreen,
} from '../screens/NotificationsScreen';

import {
  CheckoutFinalBillScreen,
} from '../screens/CheckoutFinalBillScreen';

import {
  VariableExpenseScreen,
} from '../screens/VariableExpenseScreen';

import {
  PropertyIconScreen,
} from '../screens/PropertyIconScreen';

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

  Home:
    '⌂',

  Statistics:
    '▥',

  Settings:
    '⚙',
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
          25,

        lineHeight:
          28,

        opacity:
          focused
            ? 1
            : 0.5,
      }}
    >
      {icons[
        routeName
      ] ?? '•'}
    </Text>
  );
}

function commonTabOptions(
  route:
    any,
) {
  return {
    headerShown:
      false,

    tabBarActiveTintColor:
      colors.primary,

    tabBarInactiveTintColor:
      colors.muted,

    tabBarStyle:
      styles.tabBar,

    tabBarLabelStyle:
      styles.tabBarLabel,

    tabBarIconStyle:
      styles.tabBarIcon,

    tabBarIcon: ({
      focused,
    }: {
      focused:
        boolean;
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
  };
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
      }) =>
        commonTabOptions(
          route,
        )
      }
    >
      <Tab.Screen
        name="Dashboard"
        component={
          DashboardScreen
        }
        options={{
          title:
            t(
              'home',
              {
                defaultValue:
                  'Home',
              },
            ),
        }}
      />

      <Tab.Screen
        name="Statistics"
        component={
          LandlordStatisticsScreen
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
              {
                defaultValue:
                  'Settings',
              },
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
      }) =>
        commonTabOptions(
          route,
        )
      }
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
              {
                defaultValue:
                  'Home',
              },
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
              {
                defaultValue:
                  'Settings',
              },
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
              name="Notifications"
              component={
                NotificationsScreen
              }
              options={{
                title:
                  '',
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
              name="TenantBilling"
              component={
                TenantBillingScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="BillingHistory"
              component={
                BillingHistoryScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="PreviousRentals"
              component={
                PreviousRentalsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="PreviousRentalDetails"
              component={
                PreviousRentalDetailsScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="CheckoutFinalBill"
              component={
                CheckoutFinalBillScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="VariableExpense"
              component={
                VariableExpenseScreen
              }
              options={{
                title:
                  '',
              }}
            />

            <Stack.Screen
              name="PropertyIcon"
              component={
                PropertyIconScreen
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
        82,

      paddingTop:
        9,

      paddingBottom:
        12,

      borderTopColor:
        colors.border,
    },

    tabBarLabel: {
      fontSize:
        12,

      lineHeight:
        16,

      fontWeight:
        '700',
    },

    tabBarIcon: {
      marginTop:
        2,
    },

    loader: {
      justifyContent:
        'center',

      alignItems:
        'center',
    },
  });