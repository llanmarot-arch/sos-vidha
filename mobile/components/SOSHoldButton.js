import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { tokens, SOS_STATES } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const HOLD_MS = 1500;
const SIZE = 120;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function SOSHoldButton({
  sosState,
  onHoldStart,
  onHoldEnd,
  onHoldComplete,
  disabled,
  loading = false,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    onHoldEnd?.();
  }, [onHoldEnd, progress]);

  const startHold = useCallback(() => {
    if (disabled || loading || sosState !== SOS_STATES.IDLE) return;
    onHoldStart?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start();
    holdTimer.current = setTimeout(async () => {
      holdTimer.current = null;
      progress.setValue(0);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onHoldComplete?.();
    }, HOLD_MS);
  }, [disabled, loading, onHoldComplete, onHoldStart, progress, sosState]);

  useEffect(() => () => cancelHold(), [cancelHold]);

  const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });

  const labelMap = {
    [SOS_STATES.IDLE]: 'HOLD TO ARM EMERGENCY PROTOCOL',
    [SOS_STATES.HOLDING]: 'ARMING…',
    [SOS_STATES.COUNTDOWN]: 'ABORT WINDOW OPEN',
    [SOS_STATES.DISPATCHING]: 'DISPATCHING TELEMETRY',
    [SOS_STATES.ACTIVE_ALERT]: 'SESSION LOGGED · ALERT ACTIVE',
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        disabled={disabled || loading || sosState !== SOS_STATES.IDLE}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, (disabled || loading) && styles.btnDisabled]}
      >
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <SvgCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={tokens.color.border} strokeWidth={STROKE} fill="transparent" />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={tokens.color.critical}
            strokeWidth={STROKE}
            fill="transparent"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        {loading ? (
          <ActivityIndicator color={tokens.color.text} />
        ) : (
          <Text style={styles.icon}>SOS</Text>
        )}
      </Pressable>
      <Text style={styles.label}>{labelMap[sosState] || labelMap[SOS_STATES.IDLE]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: tokens.spacing.md },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: tokens.color.criticalDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tokens.color.critical,
  },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.4 },
  svg: { position: 'absolute' },
  icon: { color: tokens.color.text, fontWeight: '900', fontSize: 24, letterSpacing: 2 },
  label: { color: tokens.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.8, textAlign: 'center' },
});
