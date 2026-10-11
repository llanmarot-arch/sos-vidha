import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';
import { useBlackBoxStore } from '../store/useBlackBoxStore';

export default function BlackBoxPanel() {
  const recording = useBlackBoxStore((s) => s.recording);
  const silentMode = useBlackBoxStore((s) => s.silentMode);
  const frameCount = useBlackBoxStore((s) => s.frameCount);
  const bufferKb = useBlackBoxStore((s) => s.bufferKb);
  const signature = useBlackBoxStore((s) => s.signature);
  const spectrum = useBlackBoxStore((s) => s.spectrum);
  const setSilentMode = useBlackBoxStore((s) => s.setSilentMode);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" aria-level={2}>
          Audio evidence
        </Text>
        <View style={[styles.badge, recording ? styles.badgeActive : styles.badgeIdle]}>
          <Text style={[styles.badgeText, recording && styles.badgeTextActive]}>
            {recording ? 'Recording' : 'Not recording'}
          </Text>
        </View>
      </View>
      <Text style={styles.desc}>Sound around you is recorded and secured while SOS is on.</Text>

      <View style={styles.spectrumRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {spectrum.map((level, i) => (
          <View key={i} style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${Math.max(8, level)}%` }]} />
          </View>
        ))}
      </View>

      <View style={styles.metrics}>
        <Metric label="Clips" value={String(frameCount)} />
        <Metric label="Size" value={`${bufferKb} KB`} />
        <Metric label="Mode" value={silentMode ? 'Silent' : 'Normal'} />
      </View>

      <Text style={styles.hashLabel}>Security code</Text>
      <Text style={styles.hash} numberOfLines={1}>
        {signature || 'Starts when SOS begins'}
      </Text>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Silent mode</Text>
        <Switch
          value={silentMode}
          onValueChange={setSilentMode}
          accessibilityLabel="Silent mode"
          trackColor={{ false: tokens.color.borderStrong, true: tokens.color.primary }}
          thumbColor={tokens.color.onPrimary}
          activeThumbColor={tokens.color.onPrimary}
        />
      </View>
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.lg,
    marginTop: tokens.spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { ...tokens.typography.title, color: tokens.color.text },
  desc: { color: tokens.color.textMuted, fontSize: 15, lineHeight: 22, marginBottom: tokens.spacing.md },
  badge: { borderRadius: tokens.radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  badgeActive: { backgroundColor: tokens.color.criticalSoft },
  badgeIdle: { backgroundColor: tokens.color.surfaceElevated },
  badgeText: { color: tokens.color.textMuted, fontSize: 14, fontWeight: '700' },
  badgeTextActive: { color: tokens.color.critical },
  spectrumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: tokens.spacing.md },
  barTrack: { flex: 1, height: '100%', backgroundColor: tokens.color.surfaceElevated, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: tokens.color.primary, borderRadius: 2 },
  metrics: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  metric: { flex: 1, backgroundColor: tokens.color.bg0, borderRadius: tokens.radius.md, padding: tokens.spacing.sm },
  metricLabel: { color: tokens.color.textSubtle, fontSize: 14 },
  metricValue: { color: tokens.color.text, fontWeight: '700', marginTop: 4, fontSize: 16 },
  hashLabel: { color: tokens.color.textSubtle, fontSize: 14, marginBottom: 4 },
  hash: { ...tokens.typography.mono, color: tokens.color.text, marginBottom: tokens.spacing.md },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: tokens.minTouch },
  toggleLabel: { color: tokens.color.text, fontWeight: '700', fontSize: 16 },
});
