import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Badge,
  Card,
} from './ui';

import {
  TenantMonthlyBillState,
  TenantMonthlyBillSummary,
} from '../services/tenantBillingSummaryRepository';

import {
  colors,
  spacing,
} from '../theme';

function monthLabel(
  billingPeriod:
    string,
) {
  const match =
    billingPeriod.match(
      /^(\d{4})-(\d{2})/,
    );

  if (
    !match
  ) {
    return billingPeriod;
  }

  const date =
    new Date(
      Number(
        match[1],
      ),
      Number(
        match[2],
      ) -
        1,
      1,
    );

  return date.toLocaleDateString(
    undefined,
    {
      month:
        'long',

      year:
        'numeric',
    },
  );
}

function dueDay(
  dueDate:
    string | undefined,
  fallback:
    number | undefined,
) {
  if (
    dueDate
  ) {
    const match =
      dueDate.match(
        /^\d{4}-\d{2}-(\d{2})/,
      );

    if (
      match
    ) {
      return Number(
        match[1],
      );
    }
  }

  return fallback;
}

function statusBadge(
  state:
    TenantMonthlyBillState,
) {
  switch (
    state
  ) {
    case 'PAID':
      return {
        text:
          'Paid',

        tone:
          'success' as const,
      };

    case 'OVERDUE':
      return {
        text:
          'Delayed',

        tone:
          'warning' as const,
      };

    case 'PARTIALLY_PAID':
      return {
        text:
          'Partial',

        tone:
          'warning' as const,
      };

    default:
      return {
        text:
          'Pending',

        tone:
          'neutral' as const,
      };
  }
}

function money(
  amount:
    number,
  currency:
    string,
) {
  return `${amount.toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        Number.isInteger(
          amount,
        )
          ? 0
          : 2,

      maximumFractionDigits:
        2,
    },
  )} ${currency}`;
}

export function MonthlyBillCard({
  bill,
  paymentDueDay,
  onPress,
}: {
  bill:
    TenantMonthlyBillSummary;

  paymentDueDay?:
    number;

  onPress:
    () => void;
}) {
  const badge =
    statusBadge(
      bill.paymentState,
    );

  const day =
    dueDay(
      bill.dueDate,
      paymentDueDay,
    );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        pressed &&
          styles.pressed,
      ]}
    >
      <Card>
        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.flex
            }
          >
            <Text
              style={
                styles.month
              }
            >
              {monthLabel(
                bill.billingPeriod,
              )}
            </Text>

            <Text
              style={
                styles.due
              }
            >
              {day
                ? `Payment due · day ${day}`
                : 'Payment due'}
            </Text>
          </View>

          <Badge
            text={
              badge.text
            }
            tone={
              badge.tone
            }
          />
        </View>

        <View
          style={
            styles.separator
          }
        />

        {bill.totals.map(
          total => (
            <View
              key={
                total.currency
              }
              style={
                styles.totalRow
              }
            >
              <Text
                style={
                  styles.currency
                }
              >
                {
                  total.currency
                }
              </Text>

              <Text
                style={
                  styles.amount
                }
              >
                {money(
                  total.amount,
                  total.currency,
                )}
              </Text>
            </View>
          ),
        )}

        <Text
          style={
            styles.viewBill
          }
        >
          View bill ›
        </Text>
      </Card>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex:
        1,
    },

    pressed: {
      opacity:
        0.72,
    },

    header: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',

      gap:
        spacing.md,
    },

    month: {
      color:
        colors.text,

      fontSize:
        18,

      fontWeight:
        '900',
    },

    due: {
      color:
        colors.muted,

      fontSize:
        12,

      marginTop:
        4,
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        spacing.md,
    },

    totalRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        spacing.md,

      marginBottom:
        12,
    },

    currency: {
      color:
        colors.muted,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    amount: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    viewBill: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '900',

      marginTop:
        2,
    },
  });