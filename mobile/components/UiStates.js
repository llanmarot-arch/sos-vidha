import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { tokens } from '../theme/tokens';

export function LoadingState({ message = 'INITIALIZING SYSTEM…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={tokens.color.primaryBright} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, description }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>SYSTEM ERROR</Text>
      <Text style={styles.desc}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onRetry}>
          <Text style={styles.retry}>RETRY OPERATION</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SuccessBanner({ message }) {
  return (
    <View style={styles.success}>
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl, gap: tokens.spacing.sm },
  text: { color: tokens.color.textMuted, marginTop: tokens.spacing.sm, letterSpacing: 0.5, fontSize: 12 },
  title: { color: tokens.color.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },
  desc: { color: tokens.color.textMuted, textAlign: 'center', lineHeight: 20, fontSize: 13 },
  errorTitle: { color: tokens.color.critical, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  retry: { color: tokens.color.primaryBright, fontWeight: '700', marginTop: tokens.spacing.md, letterSpacing: 0.6 },
  success: {
    backgroundColor: 'rgba(0,128,128,0.15)',
    borderColor: tokens.color.primary,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  successText: { color: tokens.color.primaryBright, fontWeight: '700', textAlign: 'center', fontSize: 12, letterSpacing: 0.4 },
});
