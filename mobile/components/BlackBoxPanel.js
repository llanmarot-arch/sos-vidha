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
        <Text style={styles.title}>EVIDENCE BLACK BOX</Text>
        <View style={[styles.badge, recording ? styles.badgeActive : styles.badgeIdle]}>
          <Text style={styles.badgeText}>{recording ? 'RECORDING' : 'STANDBY'}</Text>
        </View>
      </View>

      <View style={styles.spectrumRow}>
        {spectrum.map((level, i) => (
          <View key={i} style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${Math.max(8, level)}%` }]} />
          </View>
        ))}
      </View>

      <View style={styles.metrics}>
        <Metric label="FRAMES" value={String(frameCount)} />
        <Metric label="BUFFER" value={`${bufferKb} KB`} />
        <Metric label="MODE" value={silentMode ? 'STEALTH' : 'STANDARD'} />
      </View>

      <Text style={styles.hashLabel}>ENCRYPTED SIGNATURE</Text>
      <Text style={styles.hash} numberOfLines={1}>
        {signature || 'AWAITING SESSION ARM'}
      </Text>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>SILENT AMBIENT MODE</Text>
        <Switch
          value={silentMode}
          onValueChange={setSilentMode}
          trackColor={{ false: tokens.color.border, true: tokens.color.primary }}
          thumbColor={tokens.color.text}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.md },
  title: { ...tokens.typography.caption, color: tokens.color.primaryBright },
  badge: { borderRadius: tokens.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeActive: { backgroundColor: 'rgba(220,38,38,0.2)', borderWidth: 1, borderColor: tokens.color.critical },
  badgeIdle: { backgroundColor: tokens.color.surfaceElevated, borderWidth: 1, borderColor: tokens.color.border },
  badgeText: { color: tokens.color.text, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  spectrumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56, marginBottom: tokens.spacing.md },
  barTrack: { flex: 1, height: '100%', backgroundColor: tokens.color.bg2, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: tokens.color.primaryBright, borderRadius: 2 },
  metrics: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  metric: { flex: 1, backgroundColor: tokens.color.bg2, borderRadius: tokens.radius.sm, padding: tokens.spacing.sm },
  metricLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, fontSize: 9 },
  metricValue: { color: tokens.color.text, fontWeight: '800', marginTop: 4, fontSize: 13 },
  hashLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, marginBottom: 4 },
  hash: { ...tokens.typography.mono, color: tokens.color.primaryLight, marginBottom: tokens.spacing.md },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { color: tokens.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.6 },
});
