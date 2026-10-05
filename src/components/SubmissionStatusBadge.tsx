import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SubmissionState,
} from '../services/meterSubmissionStatus';

type Props = {
  state:
    SubmissionState;

  text?:
    string;
};

function defaultText(
  state:
    SubmissionState,
) {
  switch (state) {
    case 'COMPLETE':
      return 'Submitted';

    case 'DUE':
      return 'Due';

    case 'OVERDUE':
      return 'Overdue';

    default:
      return 'Not required';
  }
}

export function SubmissionStatusBadge({
  state,
  text,
}: Props) {
  return (
    <View
      style={[
        styles.badge,

        state ===
          'COMPLETE' &&
          styles.complete,

        state ===
          'DUE' &&
          styles.due,

        state ===
          'OVERDUE' &&
          styles.overdue,

        state ===
          'NOT_REQUIRED' &&
          styles.neutral,
      ]}
    >
      <Text
        style={[
          styles.text,

          state ===
            'COMPLETE' &&
            styles.completeText,

          state ===
            'DUE' &&
            styles.dueText,

          state ===
            'OVERDUE' &&
            styles.overdueText,

          state ===
            'NOT_REQUIRED' &&
            styles.neutralText,
        ]}
      >
        {text ??
          defaultText(
            state,
          )}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    badge: {
      borderRadius:
        999,

      paddingHorizontal:
        10,

      paddingVertical:
        6,

      alignSelf:
        'flex-start',
    },

    text: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    complete: {
      backgroundColor:
        '#DCFCE7',
    },

    completeText: {
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

    neutral: {
      backgroundColor:
        '#F2F4F7',
    },

    neutralText: {
      color:
        '#475467',
    },
  });