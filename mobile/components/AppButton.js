import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

function createStyles(theme) {
  return {
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: theme.minTouch,
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      paddingHorizontal: 18,
    },
    primary: {
      backgroundColor: theme.color.primary,
      borderWidth: theme.color.primaryBorderWidth,
      borderColor: theme.color.primaryBorder,
    },
    critical: { backgroundColor: theme.color.criticalFill },
    ghost: {
      backgroundColor: theme.color.surface,
      borderWidth: 1.5,
      borderColor: theme.color.ghostBorder,
    },
    disabled: { opacity: 0.45 },
    label: { fontWeight: '700', fontSize: 16, textAlign: 'center' },
    labelPrimary: { color: theme.color.onPrimary },
    labelCritical: { color: theme.color.onCritical },
    labelGhost: { color: theme.color.ghostText },
  };
}

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
  const { theme, styles } = useThemedStyles(createStyles);
  const isPrimary = variant === 'primary';
  const isCritical = variant === 'critical';
  const isGhost = variant === 'ghost';
  const isDisabled = disabled || loading;
  const spinnerColor = isGhost ? theme.color.ghostText : isCritical ? theme.color.onCritical : theme.color.onPrimary;

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
        <ActivityIndicator color={spinnerColor} size="small" />
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
