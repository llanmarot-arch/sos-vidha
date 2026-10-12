import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

function createStyles(theme) {
  return {
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
    text: { color: theme.color.textMuted, marginTop: theme.spacing.sm, fontSize: 16 },
    title: { color: theme.color.text, fontWeight: '700', fontSize: 18, textAlign: 'center' },
    desc: { color: theme.color.textMuted, textAlign: 'center', lineHeight: 24, fontSize: 16 },
    errorTitle: { color: theme.color.critical, fontWeight: '700', fontSize: 18 },
    retryBtn: { minHeight: theme.minTouch, justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
    retry: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16 },
    success: {
      backgroundColor: theme.color.successSoft,
      borderLeftColor: theme.color.success,
      borderLeftWidth: 4,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    successText: { color: theme.color.success, fontWeight: '700', fontSize: 15, lineHeight: 22 },
  };
}

export function LoadingState({ message = 'Loading…' }) {
  const { theme, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.center} accessibilityLiveRegion="polite" accessibilityLabel={message}>
      <ActivityIndicator color={theme.color.accentOnSurface} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ title, description }) {
  const { styles } = useThemedStyles(createStyles);
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
  const { styles } = useThemedStyles(createStyles);
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
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.success} accessibilityLiveRegion="polite" role="status">
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}
