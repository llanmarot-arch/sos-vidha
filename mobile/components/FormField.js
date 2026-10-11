import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

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
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.textSubtle}
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

const styles = StyleSheet.create({
  wrap: { marginBottom: tokens.spacing.lg },
  label: { fontSize: 15, fontWeight: '700', color: tokens.color.text, marginBottom: 6 },
  hint: { fontSize: 14, color: tokens.color.textSubtle, marginBottom: 6, lineHeight: 20 },
  input: {
    minHeight: tokens.minTouch,
    backgroundColor: tokens.color.bg2,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: tokens.color.text,
    fontSize: 16,
  },
  inputError: { borderColor: tokens.color.critical, borderWidth: 2 },
  error: { color: tokens.color.critical, fontSize: 14, marginTop: 6, lineHeight: 20, fontWeight: '600' },
});
