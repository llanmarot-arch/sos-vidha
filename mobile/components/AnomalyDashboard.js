import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import AppButton from './AppButton';
import { tokens } from '../theme/tokens';
import { useAnomalyStore, ANOMALY_STATES } from '../store/useAnomalyStore';

export default function AnomalyDashboard({ onAutoTrigger }) {
  const gForce = useAnomalyStore((s) => s.gForce);
  const heartRate = useAnomalyStore((s) => s.heartRate);
  const spO2 = useAnomalyStore((s) => s.spO2);
  const state = useAnomalyStore((s) => s.state);
  const countdown = useAnomalyStore((s) => s.countdown);
  const setTelemetry = useAnomalyStore((s) => s.setTelemetry);
  const simulateImpact = useAnomalyStore((s) => s.simulateImpact);
  const abortCountdown = useAnomalyStore((s) => s.abortCountdown);

  useEffect(() => {
    Accelerometer.setUpdateInterval(400);
    Accelerometer.start();
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      if (useAnomalyStore.getState().state === ANOMALY_STATES.NORMAL) {
        const gMag = Math.sqrt(x * x + y * y + z * z);
        setTelemetry({ x, y, z }, Math.round(68 + gMag * 12), Math.round(97 - gMag * 0.5));
      }
    });
    return () => {
      sub.remove();
      Accelerometer.stop();
    };
  }, [setTelemetry]);

  const magnitude = Math.sqrt(gForce.x ** 2 + gForce.y ** 2 + gForce.z ** 2).toFixed(2);

  return (
    <View style={styles.panel}>
      <Text style={styles.title} accessibilityRole="header" aria-level={2}>
        Fall and crash detection
      </Text>
      <Text style={styles.desc}>If a hard fall or crash is detected, SOS starts automatically unless you cancel.</Text>

      <View style={styles.grid}>
        <Tile label="Movement" value={`${magnitude} G`} alert={parseFloat(magnitude) > 3} />
        <Tile label="Heart rate" value={`${heartRate} bpm`} alert={heartRate > 120} />
        <Tile label="Oxygen" value={`${spO2}%`} alert={spO2 < 92} />
        <Tile
          label="Status"
          value={state === ANOMALY_STATES.NORMAL ? 'Normal' : 'Check needed'}
          alert={state !== ANOMALY_STATES.NORMAL}
        />
      </View>

      {state === ANOMALY_STATES.COUNTDOWN ? (
        <View style={styles.countdownBox} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Text style={styles.countdownLabel}>Possible fall detected. Sending SOS in</Text>
          <Text style={styles.countdownValue}>{countdown} seconds</Text>
          <AppButton label="I'm OK, cancel" variant="ghost" onPress={abortCountdown} />
        </View>
      ) : (
        <AppButton
          label="Test fall detection"
          variant="ghost"
          onPress={() => simulateImpact(onAutoTrigger)}
          disabled={state !== ANOMALY_STATES.NORMAL}
          accessibilityHint="Simulates a fall. SOS will start after a countdown unless you cancel."
        />
      )}
    </View>
  );
}

function Tile({ label, value, alert }) {
  return (
    <View style={[styles.tile, alert && styles.tileAlert]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, alert && styles.tileValueAlert]}>
        {value}
        {alert ? ' (high)' : ''}
      </Text>
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
    marginTop: tokens.spacing.sm,
  },
  title: { ...tokens.typography.title, color: tokens.color.text, marginBottom: 4 },
  desc: { color: tokens.color.textMuted, fontSize: 15, lineHeight: 22, marginBottom: tokens.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  tile: {
    width: '48%',
    backgroundColor: tokens.color.bg0,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  tileAlert: { borderColor: tokens.color.critical, backgroundColor: tokens.color.criticalSoft },
  tileLabel: { color: tokens.color.textSubtle, fontSize: 14 },
  tileValue: { color: tokens.color.text, fontWeight: '700', marginTop: 4, fontSize: 17 },
  tileValueAlert: { color: tokens.color.critical },
  countdownBox: { alignItems: 'center', gap: tokens.spacing.sm, backgroundColor: tokens.color.criticalSoft, borderRadius: tokens.radius.md, padding: tokens.spacing.md },
  countdownLabel: { color: tokens.color.critical, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  countdownValue: { color: tokens.color.critical, fontSize: 32, fontWeight: '800' },
});
