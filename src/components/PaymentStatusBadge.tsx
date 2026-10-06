import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  TenantPaymentState,
} from '../services/billingRepository';

export function PaymentStatusBadge({
  state,
  text,
}: {
  state:
    TenantPaymentState;

  text?:
    string;
}) {
  const label =
    text ??
    (
      state ===
      'PAID'
        ? 'Paid'

        : state ===
            'OVERDUE'
          ? 'Payment overdue'

          : 'Payment due'
    );

  return (
    <View
      style={[
        styles.badge,

        state ===
          'PAID' &&
          styles.paid,

        state ===
          'DUE' &&
          styles.due,

        state ===
          'OVERDUE' &&
          styles.overdue,
      ]}
    >
      <Text
        style={[
          styles.text,

          state ===
            'PAID' &&
            styles.paidText,

          state ===
            'DUE' &&
            styles.dueText,

          state ===
            'OVERDUE' &&
            styles.overdueText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    badge: {
      alignSelf:
        'flex-start',

      borderRadius:
        999,

      paddingHorizontal:
        10,

      paddingVertical:
        6,
    },

    text: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    paid: {
      backgroundColor:
        '#DCFCE7',
    },

    paidText: {
      color:
        '#166534',
    },

    due: {
      backgroundColor:
        '#FEF3C7',
    },

    dueText: {
      color:
        '#92400E',
    },

    overdue: {
      backgroundColor:
        '#FEE2E2',
    },

    overdueText: {
      color:
        '#B42318',
    },
  });