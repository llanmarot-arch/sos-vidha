import React from 'react';
import { View, Text } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

export default function BlackBoxPanel() {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" aria-level={2}>
          Audio
        </Text>
        <View style={[styles.badge, styles.badgeIdle]}>
          <Text style={styles.badgeText}>Not available</Text>
        </View>
      </View>
      <Text style={styles.desc}>
        Audio is not recorded in this version. Nothing is saved or uploaded from the microphone.
      </Text>
    </View>
  );
}

function createStyles(theme) {
  return {
  panel: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { ...theme.typography.title, color: theme.color.text },
  desc: { color: theme.color.textMuted, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.md },
  badge: { borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  badgeActive: { backgroundColor: theme.color.criticalSoft },
  badgeIdle: { backgroundColor: theme.color.surfaceElevated },
  badgeText: { color: theme.color.textMuted, fontSize: 14, fontWeight: '700' },
  badgeTextActive: { color: theme.color.critical },
  spectrumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: theme.spacing.md },
  barTrack: { flex: 1, height: '100%', backgroundColor: theme.color.surfaceElevated, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: theme.color.accentOnSurface, borderRadius: 2 },
  metrics: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  metric: { flex: 1, backgroundColor: theme.color.bg0, borderRadius: theme.radius.md, padding: theme.spacing.sm },
  metricLabel: { color: theme.color.textSubtle, fontSize: 14 },
  metricValue: { color: theme.color.text, fontWeight: '700', marginTop: 4, fontSize: 16 },
  hashLabel: { color: theme.color.textSubtle, fontSize: 14, marginBottom: 4 },
  hash: { ...theme.typography.mono, color: theme.color.text, marginBottom: theme.spacing.md },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: theme.minTouch },
  toggleLabel: { color: theme.color.text, fontWeight: '700', fontSize: 16 },
  };
}
