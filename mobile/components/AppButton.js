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
}) {
  const isPrimary = variant === 'primary';
  const isCritical = variant === 'critical';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isCritical && styles.critical,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? tokens.color.primaryBright : tokens.color.text} size="small" />
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
    borderRadius: tokens.radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: tokens.color.primary },
  critical: { backgroundColor: tokens.color.critical },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  disabled: { opacity: 0.5 },
  label: { fontWeight: '700', fontSize: 13, letterSpacing: 0.4 },
  labelPrimary: { color: tokens.color.text },
  labelCritical: { color: tokens.color.text },
  labelGhost: { color: tokens.color.textMuted },
});
