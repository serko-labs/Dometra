import React, {
  useCallback,
  useState,
} from 'react';

import {
  Alert,
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
  Card,
  Header,
  Screen,
  SecondaryButton,
} from '../components/ui';

import {
  billingMonthLabel,
} from '../services/billingRepository';

import {
  DometraNotification,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationCenterRepository';

import {
  colors,
  spacing,
} from '../theme';

function stringValue(
  notification:
    DometraNotification,

  key:
    string,
) {
  const value =
    notification.templateData[
      key
    ];

  return typeof value ===
    'string'
    ? value
    : undefined;
}

function propertyName(
  notification:
    DometraNotification,
) {
  return stringValue(
    notification,
    'propertyName',
  ) ??
    'Apartment';
}

function notificationTitle(
  notification:
    DometraNotification,
) {
  switch (
    notification.eventType
  ) {
    case 'PAYMENT_REPORTED':
      return 'Payment reported';

    case 'PAYMENT_CONFIRMED':
      return 'Payment confirmed';

    case 'PAYMENT_REJECTED':
      return 'Payment not confirmed';

    case 'CHECKOUT_STARTED':
      return 'Checkout started';

    case 'CHECKOUT_READINGS_SUBMITTED':
      return 'Checkout readings submitted';

    case 'CHECKOUT_COMPLETED':
      return 'Checkout completed';

    default:
      return 'Dometra notification';
  }
}

function notificationBody(
  notification:
    DometraNotification,
) {
  const name =
    propertyName(
      notification,
    );

  const period =
    stringValue(
      notification,
      'billingPeriod',
    );

  switch (
    notification.eventType
  ) {
    case 'PAYMENT_REPORTED':
      return period
        ? `The tenant reported ${billingMonthLabel(
            period,
          )} as paid for ${name}.`
        : `The tenant reported a payment for ${name}.`;

    case 'PAYMENT_CONFIRMED':
      return period
        ? `Your payment for ${billingMonthLabel(
            period,
          )} at ${name} was confirmed.`
        : `Your payment for ${name} was confirmed.`;

    case 'PAYMENT_REJECTED': {
      const note =
        stringValue(
          notification,
          'note',
        );

      return note
        ? `Your payment for ${name} was not confirmed. ${note}`
        : `Your payment for ${name} was not confirmed.`;
    }

    case 'CHECKOUT_STARTED':
      return `Checkout has been started for ${name}. Final meter readings may be required.`;

    case 'CHECKOUT_READINGS_SUBMITTED':
      return `The tenant submitted all final meter readings for ${name}. Review the readings and complete checkout.`;

    case 'CHECKOUT_COMPLETED':
      return `Your tenancy at ${name} has been completed. The rental is now available in Previous rentals.`;

    default:
      return name;
  }
}

function notificationIcon(
  notification:
    DometraNotification,
) {
  switch (
    notification.eventType
  ) {
    case 'PAYMENT_REPORTED':
      return '$';

    case 'PAYMENT_CONFIRMED':
      return '✓';

    case 'PAYMENT_REJECTED':
      return '!';

    case 'CHECKOUT_STARTED':
      return '→';

    case 'CHECKOUT_READINGS_SUBMITTED':
      return '▥';

    case 'CHECKOUT_COMPLETED':
      return '✓';

    default:
      return '•';
  }
}

function formatDateTime(
  value:
    string,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  const now =
    new Date();

  const sameDay =
    now.getFullYear() ===
      date.getFullYear() &&
    now.getMonth() ===
      date.getMonth() &&
    now.getDate() ===
      date.getDate();

  if (
    sameDay
  ) {
    return date.toLocaleTimeString(
      undefined,
      {
        hour:
          '2-digit',

        minute:
          '2-digit',
      },
    );
  }

  return date.toLocaleDateString(
    undefined,
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        now.getFullYear() ===
        date.getFullYear()
          ? undefined
          : 'numeric',
    },
  );
}

export function NotificationsScreen() {
  const navigation =
    useNavigation<any>();

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      DometraNotification[]
    >([]);

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

  const reload =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          setNotifications(
            await loadNotifications(),
          );
        } catch (
          error
        ) {
          Alert.alert(
            'Notifications',

            error instanceof
            Error
              ? error.message
              : 'Unable to load notifications.',
          );
        } finally {
          setLoading(
            false,
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

  const unreadCount =
    notifications.filter(
      notification =>
        !notification.readAt,
    ).length;

  const openNotification =
    async (
      notification:
        DometraNotification,
    ) => {
      try {
        if (
          !notification.readAt
        ) {
          await markNotificationRead(
            notification.id,
          );

          setNotifications(
            current =>
              current.map(
                item =>
                  item.id ===
                  notification.id
                    ? {
                        ...item,

                        readAt:
                          new Date()
                            .toISOString(),
                      }
                    : item,
              ),
          );
        }
      } catch (
        error
      ) {
        console.warn(
          '[Dometra] Unable to mark notification read:',
          error,
        );
      }

      switch (
        notification.eventType
      ) {
        case 'PAYMENT_REPORTED':

          if (
            notification.propertyId
          ) {
            navigation.navigate(
              'TenantDetails',
              {
                propertyId:
                  notification.propertyId,

                propertyName:
                  propertyName(
                    notification,
                  ),
              },
            );
          }

          return;


        case 'PAYMENT_CONFIRMED':

        case 'PAYMENT_REJECTED':

          if (
            notification.tenancyId
          ) {
            navigation.navigate(
              'TenantApartment',
              {
                tenancyId:
                  notification.tenancyId,
              },
            );
          }

          return;


        case 'CHECKOUT_STARTED':

          if (
            notification.tenancyId
          ) {
            navigation.navigate(
              'TenantCheckout',
              {
                tenancyId:
                  notification.tenancyId,
              },
            );
          }

          return;


        case 'CHECKOUT_READINGS_SUBMITTED':

          if (
            notification.propertyId ||
            notification.tenancyId
          ) {
            navigation.navigate(
              'CheckoutTenant',
              {
                propertyId:
                  notification.propertyId,

                tenancyId:
                  notification.tenancyId,
              },
            );
          }

          return;


        case 'CHECKOUT_COMPLETED':

          if (
            notification.tenancyId
          ) {
            navigation.navigate(
              'PreviousRentalDetails',
              {
                tenancyId:
                  notification.tenancyId,
              },
            );
          }

          return;


        default:

          if (
            notification.propertyId
          ) {
            navigation.navigate(
              'PropertyDetails',
              {
                propertyId:
                  notification.propertyId,
              },
            );
          }
      }
    };

  const markEverythingRead =
    async () => {
      if (
        busy ||
        unreadCount ===
          0
      ) {
        return;
      }

      setBusy(
        true,
      );

      try {
        await markAllNotificationsRead();

        const now =
          new Date()
            .toISOString();

        setNotifications(
          current =>
            current.map(
              notification => ({
                ...notification,

                readAt:
                  notification.readAt ??
                  now,
              }),
            ),
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Notifications',

          error instanceof
          Error
            ? error.message
            : 'Unable to mark notifications as read.',
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
        title="Notifications"
        subtitle={
          unreadCount >
          0
            ? `${unreadCount} unread`
            : 'You are all caught up'
        }
      />

      {unreadCount >
      0 ? (
        <SecondaryButton
          title={
            busy
              ? 'Saving...'
              : 'Mark all as read'
          }
          onPress={() =>
            void markEverythingRead()
          }
        />
      ) : null}

      {loading ? (
        <Card>
          <Text
            style={
              styles.muted
            }
          >
            Loading notifications...
          </Text>
        </Card>
      ) : null}

      {!loading &&
      notifications.length ===
        0 ? (
        <Card>
          <View
            style={
              styles.empty
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Text
                style={
                  styles.emptyIconText
                }
              >
                ✓
              </Text>
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No notifications
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Payment updates, checkout events and important rental activity will appear here.
            </Text>
          </View>
        </Card>
      ) : null}

      {!loading &&
      notifications.map(
        notification => {
          const unread =
            !notification.readAt;

          return (
            <Pressable
              key={
                notification.id
              }
              onPress={() =>
                void openNotification(
                  notification,
                )
              }
              style={({
                pressed,
              }) => [
                styles.pressable,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Card>
                <View
                  style={
                    styles.notificationRow
                  }
                >
                  <View
                    style={[
                      styles.icon,

                      unread &&
                        styles.iconUnread,
                    ]}
                  >
                    <Text
                      style={[
                        styles.iconText,

                        unread &&
                          styles.iconTextUnread,
                      ]}
                    >
                      {notificationIcon(
                        notification,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.flex
                    }
                  >
                    <View
                      style={
                        styles.titleRow
                      }
                    >
                      <Text
                        style={[
                          styles.title,

                          unread &&
                            styles.titleUnread,
                        ]}
                      >
                        {notificationTitle(
                          notification,
                        )}
                      </Text>

                      <Text
                        style={
                          styles.time
                        }
                      >
                        {formatDateTime(
                          notification.createdAt,
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.body
                      }
                    >
                      {notificationBody(
                        notification,
                      )}
                    </Text>
                  </View>

                  {unread ? (
                    <View
                      style={
                        styles.unreadDot
                      }
                    />
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        },
      )}
    </Screen>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex:
        1,
    },

    pressable: {
      marginBottom:
        spacing.sm,
    },

    pressed: {
      opacity:
        0.7,
    },

    notificationRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        spacing.md,
    },

    icon: {
      width:
        42,

      height:
        42,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F1F5F9',
    },

    iconUnread: {
      backgroundColor:
        '#EAF1FF',
    },

    iconText: {
      color:
        colors.muted,

      fontSize:
        18,

      fontWeight:
        '900',
    },

    iconTextUnread: {
      color:
        colors.primary,
    },

    titleRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'flex-start',

      gap:
        spacing.sm,
    },

    title: {
      flex:
        1,

      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    titleUnread: {
      fontWeight:
        '900',
    },

    body: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      marginTop:
        4,
    },

    time: {
      color:
        colors.muted,

      fontSize:
        10,
    },

    unreadDot: {
      width:
        8,

      height:
        8,

      borderRadius:
        4,

      backgroundColor:
        colors.primary,

      marginTop:
        5,
    },

    empty: {
      alignItems:
        'center',

      paddingVertical:
        spacing.lg,
    },

    emptyIcon: {
      width:
        54,

      height:
        54,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#DCFCE7',

      marginBottom:
        spacing.md,
    },

    emptyIconText: {
      color:
        '#166534',

      fontSize:
        22,

      fontWeight:
        '900',
    },

    emptyTitle: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    emptyText: {
      color:
        colors.muted,

      fontSize:
        12,

      lineHeight:
        18,

      textAlign:
        'center',

      marginTop:
        5,
    },

    muted: {
      color:
        colors.muted,

      fontSize:
        12,
    },
  });