import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { tokens, SOS_STATES } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
const HOLD_MS = 1500;
const SIZE = 150;
const STROKE = 6;
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
    [SOS_STATES.IDLE]: disabled ? 'Add a contact to turn on SOS' : 'Press and hold for SOS',
    [SOS_STATES.HOLDING]: 'Keep holding…',
    [SOS_STATES.COUNTDOWN]: 'You can still cancel',
    [SOS_STATES.DISPATCHING]: 'Sending SOS alert…',
    [SOS_STATES.ACTIVE_ALERT]: 'SOS alert is on',
  };

  const isInactive = disabled || loading || sosState !== SOS_STATES.IDLE;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        disabled={isInactive}
        accessibilityRole="button"
        accessibilityLabel="SOS emergency button"
        accessibilityHint="Press and hold to start an SOS alert. You can cancel during the countdown."
        accessibilityState={{ disabled: isInactive, busy: loading }}
        accessibilityActions={[{ name: 'longpress', label: 'Start SOS alert' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress' && !isInactive) onHoldComplete?.();
        }}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, (disabled || loading) && styles.btnDisabled]}
      >
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <SvgCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.3)" strokeWidth={STROKE} fill="transparent" />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={tokens.color.onCritical}
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
          <ActivityIndicator color={tokens.color.onCritical} />
        ) : (
          <Text style={styles.icon}>SOS</Text>
        )}
      </Pressable>
      <Text style={styles.label} accessibilityLiveRegion="polite">
        {labelMap[sosState] || labelMap[SOS_STATES.IDLE]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: tokens.spacing.md },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: tokens.color.criticalFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: tokens.color.criticalSoft,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.4 },
  svg: { position: 'absolute', top: -6, left: -6 },
  icon: { color: tokens.color.onCritical, fontWeight: '800', fontSize: 30, letterSpacing: 2 },
  label: { color: tokens.color.text, fontWeight: '600', fontSize: 16, textAlign: 'center' },
});
