import React from 'react';

import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  colors,
} from '../theme';

export function PropertyThumbnail({
  uri,
  size = 72,
  editable = false,
}: {
  uri?:
    string;

  size?:
    number;

  editable?:
    boolean;
}) {
  return (
    <View
      style={[
        styles.container,

        {
          width:
            size,

          height:
            size,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{
            uri,
          }}
          style={
            styles.image
          }
          resizeMode="cover"
        />
      ) : (
        <View
          style={
            styles.defaultIcon
          }
        >
          <Text
            style={[
              styles.defaultGlyph,

              {
                fontSize:
                  size *
                  0.48,
              },
            ]}
          >
            ▦
          </Text>
        </View>
      )}

      {editable ? (
        <View
          style={
            styles.editBadge
          }
        >
          <Text
            style={
              styles.editGlyph
            }
          >
            ✎
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      borderRadius:
        14,

      overflow:
        'hidden',

      backgroundColor:
        '#EAF1FF',

      borderWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    image: {
      width:
        '100%',

      height:
        '100%',
    },

    defaultIcon: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EAF1FF',
    },

    defaultGlyph: {
      color:
        colors.primary,

      fontWeight:
        '700',
    },

    editBadge: {
      position:
        'absolute',

      right:
        4,

      bottom:
        4,

      width:
        23,

      height:
        23,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        colors.border,
    },

    editGlyph: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '900',

      marginTop:
        -1,
    },
  });