import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../services/apiClient';
import { useThemedStyles } from '../theme/useTheme';

const PIN_LENGTH = 4;
const SHEET_HEIGHT = Dimensions.get('window').height * 0.72;

export default function DisarmModal({
  visible,
  sessionId,
  pinSalt,
  disarmToken,
  onDisarmSuccess,
  onClose,
}) {
  const { theme, styles } = useThemedStyles(createDisarmStyles);
  const [pin, setPin] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPin('');
      setStatusMessage('');
      setShowPinPad(false);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      attemptBiometric();
    } else {
      slideAnim.setValue(SHEET_HEIGHT);
      backdropAnim.setValue(0);
    }
  }, [visible]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose?.());
  }, [onClose, slideAnim, backdropAnim]);

  const submitDisarm = async ({ pin, method, token } = {}) => {
    if (!sessionId) return;

    setSubmitting(true);
    try {
      const data = await apiClient.disarmSession({
        sessionId,
        pin,
        disarmToken: token,
        method,
      });

      if (data.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatusMessage('Alert Cancelled Successfully');
        setTimeout(() => {
          onDisarmSuccess?.(data);
          closeSheet();
        }, 900);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setStatusMessage(data.error || 'Disarm failed');
        setPin('');
      }
    } catch (err) {
      setStatusMessage(err.message || 'Network error');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const attemptBiometric = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled || !disarmToken) {
        setShowPinPad(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to disarm SOS-Vidha alert',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
      });

      if (result.success) {
        await submitDisarm({ method: 'BIOMETRIC', token: disarmToken });
      } else {
        setShowPinPad(true);
      }
    } catch {
      setShowPinPad(true);
    }
  }, [sessionId, disarmToken]);

  const handlePinPress = async (digit) => {
    if (pin.length >= PIN_LENGTH || submitting || !pinSalt) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pin + digit;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      await submitDisarm({ pin: next, method: 'PIN' });
    }
  };

  const handleBackspace = async () => {
    await Haptics.selectionAsync();
    setPin((prev) => prev.slice(0, -1));
  };

  const renderKey = (label, onPress, wide = false) => (
    <Pressable
      style={({ pressed }) => [
        styles.key,
        wide && styles.keyWide,
        pressed && styles.keyPressed,
      ]}
      onPress={onPress}
      disabled={submitting}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={closeSheet}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          <Text style={styles.title}>Disarm Safety Alert</Text>
          <Text style={styles.subtitle}>
            {showPinPad
              ? 'Enter your 4-digit PIN to cancel'
              : 'Confirm identity with Face ID / Touch ID'}
          </Text>

          {submitting ? (
            <ActivityIndicator size="large" color={theme.color.success} style={styles.loader} />
          ) : null}

          {statusMessage ? (
            <Text style={[styles.status, statusMessage.includes('Successfully') && styles.statusOk]}>
              {statusMessage}
            </Text>
          ) : null}

          {!showPinPad && !submitting ? (
            <TouchableOpacity style={styles.biometricBtn} onPress={attemptBiometric}>
              <Text style={styles.biometricText}>Authenticate with Biometrics</Text>
            </TouchableOpacity>
          ) : null}

          {showPinPad && !submitting ? (
            <>
              <View style={styles.pinRow}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled]} />
                ))}
              </View>
              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <View key={n}>{renderKey(String(n), () => handlePinPress(String(n)))}</View>
                ))}
                <View style={styles.keySpacer} />
                {renderKey('0', () => handlePinPress('0'))}
                {renderKey('⌫', handleBackspace)}
              </View>
            </>
          ) : null}

          <TouchableOpacity style={styles.cancelLink} onPress={closeSheet}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createDisarmStyles(theme) {
  return {
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.overlay,
  },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: theme.color.border,
    minHeight: SHEET_HEIGHT,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.borderStrong,
    marginBottom: 20,
  },
  title: {
    color: theme.color.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.color.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  loader: { marginVertical: 20 },
  status: {
    color: theme.color.critical,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
  },
  statusOk: { color: theme.color.success },
  biometricBtn: {
    backgroundColor: theme.color.success,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  biometricText: {
    color: theme.color.onSuccess,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 28,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.color.borderStrong,
  },
  pinDotFilled: {
    backgroundColor: theme.color.success,
    borderColor: theme.color.success,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.color.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  keyWide: { width: 160 },
  keyPressed: { backgroundColor: theme.color.border, transform: [{ scale: 0.96 }] },
  keySpacer: { width: 76, height: 76 },
  keyText: { color: theme.color.text, fontSize: 26, fontWeight: '600' },
  cancelLink: { marginTop: 24, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelText: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16 },
  };
}
