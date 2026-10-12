import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

function createStyles(theme) {
  return {
    wrap: { marginBottom: theme.spacing.lg },
    label: { fontSize: 15, fontWeight: '700', color: theme.color.text, marginBottom: 6 },
    hint: { fontSize: 14, color: theme.color.textSubtle, marginBottom: 6, lineHeight: 20 },
    input: {
      minHeight: theme.minTouch,
      backgroundColor: theme.color.bg2,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.color.borderStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.color.text,
      fontSize: 16,
    },
    inputError: { borderColor: theme.color.critical, borderWidth: 2 },
    error: { color: theme.color.critical, fontSize: 14, marginTop: 6, lineHeight: 20, fontWeight: '600' },
  };
}

export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  error = null,
  accessibilityLabel,
  hint,
}) {
  const { theme, styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textSubtle}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={error || hint}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
