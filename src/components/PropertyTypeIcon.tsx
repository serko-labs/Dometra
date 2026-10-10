import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  colors,
} from '../theme';

export type PropertyTypeIconSize =
  | 'small'
  | 'medium'
  | 'large';

interface PropertyTypeIconProps {
  propertyType?:
    | string
    | null;

  size?:
    PropertyTypeIconSize;
}

interface PropertyTypeConfig {
  glyph: string;
  label: string;
}

const PROPERTY_TYPE_CONFIG:
Record<
  string,
  PropertyTypeConfig
> = {
  APARTMENT: {
    glyph:
      '▦',

    label:
      'Apartment',
  },

  FLAT: {
    glyph:
      '▦',

    label:
      'Apartment',
  },

  HOUSE: {
    glyph:
      '⌂',

    label:
      'House',
  },

  HOME: {
    glyph:
      '⌂',

    label:
      'House',
  },

  STUDIO: {
    glyph:
      '▣',

    label:
      'Studio',
  },

  ROOM: {
    glyph:
      '▤',

    label:
      'Room',
  },

  OFFICE: {
    glyph:
      '▧',

    label:
      'Office',
  },

  COMMERCIAL: {
    glyph:
      '▥',

    label:
      'Commercial property',
  },

  COMMERCIAL_PROPERTY: {
    glyph:
      '▥',

    label:
      'Commercial property',
  },

  BUILDING: {
    glyph:
      '▦',

    label:
      'Building',
  },

  OTHER: {
    glyph:
      '◇',

    label:
      'Property',
  },
};

const DEFAULT_CONFIG:
PropertyTypeConfig = {
  glyph:
    '▦',

  label:
    'Property',
};

const SIZE_CONFIG = {
  small: {
    container:
      34,

    glyph:
      20,
  },

  medium: {
    container:
      44,

    glyph:
      25,
  },

  large: {
    container:
      56,

    glyph:
      32,
  },
} as const;

function normalizePropertyType(
  propertyType?:
    | string
    | null,
) {
  return (
    propertyType
      ?.trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        '_',
      ) ??
    'APARTMENT'
  );
}

export function getPropertyTypeIconGlyph(
  propertyType?:
    | string
    | null,
) {
  const normalizedType =
    normalizePropertyType(
      propertyType,
    );

  return (
    PROPERTY_TYPE_CONFIG[
      normalizedType
    ] ??
    DEFAULT_CONFIG
  ).glyph;
}

export function getPropertyTypeLabel(
  propertyType?:
    | string
    | null,
) {
  const normalizedType =
    normalizePropertyType(
      propertyType,
    );

  return (
    PROPERTY_TYPE_CONFIG[
      normalizedType
    ] ??
    DEFAULT_CONFIG
  ).label;
}

export function PropertyTypeIcon({
  propertyType,

  size =
    'medium',
}: PropertyTypeIconProps) {
  const normalizedType =
    normalizePropertyType(
      propertyType,
    );

  const propertyConfig =
    PROPERTY_TYPE_CONFIG[
      normalizedType
    ] ??
    DEFAULT_CONFIG;

  const dimensions =
    SIZE_CONFIG[
      size
    ];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        propertyConfig.label
      }
      style={[
        styles.container,
        {
          width:
            dimensions.container,

          height:
            dimensions.container,

          borderRadius:
            dimensions.container /
            2,
        },
      ]}
    >
      <Text
        allowFontScaling={
          false
        }
        style={[
          styles.glyph,
          {
            fontSize:
              dimensions.glyph,
          },
        ]}
      >
        {
          propertyConfig.glyph
        }
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F4F7FF',

      borderColor:
        colors.border,

      borderWidth:
        StyleSheet.hairlineWidth,

      flexShrink:
        0,
    },

    glyph: {
      color:
        colors.primary,

      fontWeight:
        '800',

      lineHeight:
        36,

      textAlign:
        'center',

      includeFontPadding:
        false,
    },
  });