import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { tokens } from '../theme/tokens';

export function LoadingState({ message = 'Loading…' }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite" accessibilityLabel={message}>
      <ActivityIndicator color={tokens.color.primary} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, description }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="header" aria-level={2}>
        {title}
      </Text>
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.desc}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onRetry} accessibilityRole="button" style={styles.retryBtn}>
          <Text style={styles.retry}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SuccessBanner({ message }) {
  return (
    <View style={styles.success} accessibilityLiveRegion="polite" role="status">
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl, gap: tokens.spacing.sm },
  text: { color: tokens.color.textMuted, marginTop: tokens.spacing.sm, fontSize: 16 },
  title: { color: tokens.color.text, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  desc: { color: tokens.color.textMuted, textAlign: 'center', lineHeight: 24, fontSize: 16 },
  errorTitle: { color: tokens.color.critical, fontWeight: '700', fontSize: 18 },
  retryBtn: { minHeight: tokens.minTouch, justifyContent: 'center', paddingHorizontal: tokens.spacing.lg },
  retry: { color: tokens.color.primary, fontWeight: '700', fontSize: 16 },
  success: {
    backgroundColor: tokens.color.successSoft,
    borderLeftColor: tokens.color.success,
    borderLeftWidth: 4,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  successText: { color: tokens.color.success, fontWeight: '700', fontSize: 15, lineHeight: 22 },
});
