import React, {
  ReactNode,
  useMemo,
  useRef,
} from 'react';

import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  colors,
  radius,
} from '../theme';

const ACTION_WIDTH = 84;

const ACTIONS_WIDTH =
  ACTION_WIDTH * 2;

const OPEN_THRESHOLD =
  ACTIONS_WIDTH * 0.3;

interface SwipeActionsProps {
  children: ReactNode;

  onEdit: () => void;

  onRemove: () => void;
}

export function SwipeActions({
  children,
  onEdit,
  onRemove,
}: SwipeActionsProps) {
  const translateX =
    useRef(
      new Animated.Value(0),
    ).current;

  const isOpen =
    useRef(false);

  const gestureStart =
    useRef(0);

  const actionOpacity =
    translateX.interpolate({
      inputRange: [
        -ACTIONS_WIDTH,
        -30,
        0,
      ],

      outputRange: [
        1,
        0.7,
        0,
      ],

      extrapolate:
        'clamp',
    });

  const animateTo = (
    value: number,
  ) => {
    isOpen.current =
      value !== 0;

    Animated.spring(
      translateX,
      {
        toValue:
          value,

        useNativeDriver:
          true,

        damping:
          22,

        stiffness:
          220,

        mass:
          0.8,

        overshootClamping:
          true,
      },
    ).start();
  };

  const open = () => {
    animateTo(
      -ACTIONS_WIDTH,
    );
  };

  const close = () => {
    animateTo(0);
  };

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder:
            (
              _,
              gesture,
            ) => {
              const horizontal =
                Math.abs(
                  gesture.dx,
                );

              const vertical =
                Math.abs(
                  gesture.dy,
                );

              /*
               * Start swipe only when
               * horizontal movement is
               * clearly stronger than
               * vertical scrolling.
               */
              return (
                horizontal >
                  7 &&
                horizontal >
                  vertical * 1.2
              );
            },

          onMoveShouldSetPanResponderCapture:
            (
              _,
              gesture,
            ) => {
              const horizontal =
                Math.abs(
                  gesture.dx,
                );

              const vertical =
                Math.abs(
                  gesture.dy,
                );

              return (
                horizontal >
                  7 &&
                horizontal >
                  vertical * 1.2
              );
            },

          onPanResponderGrant:
            () => {
              gestureStart.current =
                isOpen.current
                  ? -ACTIONS_WIDTH
                  : 0;

              translateX.stopAnimation();
            },

          onPanResponderMove:
            (
              _,
              gesture,
            ) => {
              let next =
                gestureStart.current +
                gesture.dx;

              /*
               * Never allow swiping
               * farther right than
               * original position.
               */
              if (
                next > 0
              ) {
                next = 0;
              }

              /*
               * Give a tiny bit of
               * resistance after actions
               * are fully exposed.
               */
              if (
                next <
                -ACTIONS_WIDTH
              ) {
                const extra =
                  Math.abs(
                    next +
                      ACTIONS_WIDTH,
                  );

                next =
                  -ACTIONS_WIDTH -
                  Math.min(
                    extra *
                      0.15,
                    14,
                  );
              }

              translateX.setValue(
                next,
              );
            },

          onPanResponderRelease:
            (
              _,
              gesture,
            ) => {
              const finalPosition =
                gestureStart.current +
                gesture.dx;

              /*
               * Quick left flick.
               */
              if (
                gesture.vx <
                -0.35
              ) {
                open();

                return;
              }

              /*
               * Quick right flick.
               */
              if (
                gesture.vx >
                0.35
              ) {
                close();

                return;
              }

              /*
               * Normal threshold.
               */
              if (
                finalPosition <
                -OPEN_THRESHOLD
              ) {
                open();
              } else {
                close();
              }
            },

          onPanResponderTerminate:
            () => {
              if (
                isOpen.current
              ) {
                open();
              } else {
                close();
              }
            },
        }),
      [
        translateX,
      ],
    );

  const handleEdit = () => {
    close();

    setTimeout(
      () => {
        onEdit();
      },
      120,
    );
  };

  const handleRemove =
    () => {
      close();

      setTimeout(
        () => {
          onRemove();
        },
        120,
      );
    };

  return (
    <View
      style={
        styles.container
      }
    >
      {/*
       * Actions are absolutely positioned
       * behind the foreground.
       *
       * Opacity = 0 when row is closed,
       * so they can NEVER be visible before
       * the user starts swiping.
       */}
      <Animated.View
        pointerEvents={
          isOpen.current
            ? 'auto'
            : 'box-none'
        }
        style={[
          styles.actionsContainer,

          {
            opacity:
              actionOpacity,
          },
        ]}
      >
        <Pressable
          onPress={
            handleEdit
          }
          style={({
            pressed,
          }) => [
            styles.actionButton,

            styles.editButton,

            pressed &&
              styles.actionPressed,
          ]}
        >
          <Text
            style={
              styles.actionIcon
            }
          >
            ✎
          </Text>

          <Text
            style={
              styles.actionText
            }
          >
            Edit
          </Text>
        </Pressable>

        <Pressable
          onPress={
            handleRemove
          }
          style={({
            pressed,
          }) => [
            styles.actionButton,

            styles.removeButton,

            pressed &&
              styles.actionPressed,
          ]}
        >
          <Text
            style={
              styles.actionIcon
            }
          >
            ×
          </Text>

          <Text
            style={
              styles.actionText
            }
          >
            Remove
          </Text>
        </Pressable>
      </Animated.View>

      {/*
       * Full-width opaque foreground.
       *
       * This is critical:
       * it completely covers the action
       * buttons while row is closed.
       */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.foreground,

          {
            transform: [
              {
                translateX,
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      width:
        '100%',

      position:
        'relative',

      overflow:
        'hidden',

      borderRadius:
        radius.sm,
    },

    /*
     * Buttons live behind the row.
     */
    actionsContainer: {
      position:
        'absolute',

      right:
        0,

      top:
        0,

      bottom:
        0,

      width:
        ACTIONS_WIDTH,

      flexDirection:
        'row',

      alignItems:
        'stretch',

      justifyContent:
        'flex-end',
    },

    actionButton: {
      width:
        ACTION_WIDTH,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        4,
    },

    editButton: {
      backgroundColor:
        '#536DFE',
    },

    removeButton: {
      backgroundColor:
        colors.danger,
    },

    actionPressed: {
      opacity:
        0.8,
    },

    actionIcon: {
      color:
        '#FFFFFF',

      fontSize:
        20,

      fontWeight:
        '700',

      lineHeight:
        22,
    },

    actionText: {
      color:
        '#FFFFFF',

      fontSize:
        12,

      fontWeight:
        '700',
    },

    /*
     * The foreground MUST be full width
     * and opaque.
     *
     * Otherwise the buttons behind it are
     * visible before the swipe begins.
     */
    foreground: {
      width:
        '100%',

      backgroundColor:
        colors.background,
    },
  });