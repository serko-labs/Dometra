import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useTranslation,
} from 'react-i18next';

import {
  MeterSubmissionStatus,
} from '../services/meterSubmissionStatus';

interface Props {
  status?: MeterSubmissionStatus;
}

export function MeterSubmissionBadge({
  status,
}: Props) {
  const {
    t,
  } = useTranslation();

  if (!status) {
    return null;
  }

  const submitted =
    status.submitted;

  return (
    <View
      style={[
        styles.badge,

        submitted
          ? styles.successBadge
          : styles.missingBadge,
      ]}
    >
      <View
        style={[
          styles.dot,

          submitted
            ? styles.successDot
            : styles.missingDot,
        ]}
      />

      <Text
        style={[
          styles.text,

          submitted
            ? styles.successText
            : styles.missingText,
        ]}
      >
        {submitted
          ? t('meterStatusSubmitted')
          : t('meterStatusNeedValues')}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    badge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      alignSelf:
        'flex-start',

      gap:
        6,

      borderWidth:
        1,

      borderRadius:
        999,

      paddingHorizontal:
        9,

      paddingVertical:
        5,
    },

    successBadge: {
      backgroundColor:
        '#ECFDF3',

      borderColor:
        '#ABEFC6',
    },

    missingBadge: {
      backgroundColor:
        '#FEF3F2',

      borderColor:
        '#FECDCA',
    },

    dot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,
    },

    successDot: {
      backgroundColor:
        '#079455',
    },

    missingDot: {
      backgroundColor:
        '#D92D20',
    },

    text: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    successText: {
      color:
        '#067647',
    },

    missingText: {
      color:
        '#B42318',
    },
  });