import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon = null,
  accessibilityHint,
  accessibilityLabel,
}) {
  const isPrimary = variant === 'primary';
  const isCritical = variant === 'critical';
  const isGhost = variant === 'ghost';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isCritical && styles.critical,
        isGhost && styles.ghost,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? styles.labelGhost.color : tokens.color.onPrimary} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              isPrimary && styles.labelPrimary,
              isCritical && styles.labelCritical,
              isGhost && styles.labelGhost,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: tokens.minTouch,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: tokens.color.primary,
    borderWidth: tokens.accent === 'white' ? 1.5 : 0,
    borderColor: tokens.color.borderStrong,
  },
  critical: { backgroundColor: tokens.color.criticalFill },
  ghost: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1.5,
    borderColor: tokens.accent === 'white' && tokens.scheme === 'light' ? tokens.color.borderStrong : tokens.color.primary,
  },
  disabled: { opacity: 0.45 },
  label: { fontWeight: '700', fontSize: 16, textAlign: 'center' },
  labelPrimary: { color: tokens.color.onPrimary },
  labelCritical: { color: tokens.color.onCritical },
  labelGhost: {
    color: tokens.accent === 'white' && tokens.scheme === 'light' ? tokens.color.text : tokens.color.primary,
  },
});
