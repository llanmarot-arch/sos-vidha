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
      <Text style={styles.title}>VITAL ANOMALY DETECTOR</Text>

      <View style={styles.grid}>
        <Tile label="G-FORCE MAG" value={`${magnitude} G`} alert={parseFloat(magnitude) > 3} />
        <Tile label="HEART RATE" value={`${heartRate} BPM`} alert={heartRate > 120} />
        <Tile label="SpO2" value={`${spO2}%`} alert={spO2 < 92} />
        <Tile label="STATUS" value={state} alert={state !== ANOMALY_STATES.NORMAL} />
      </View>

      {state === ANOMALY_STATES.COUNTDOWN ? (
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>HAZARD COUNTDOWN ACTIVE</Text>
          <Text style={styles.countdownValue}>{countdown}s</Text>
          <AppButton label="ABORT AUTO-SOS" variant="ghost" onPress={abortCountdown} />
        </View>
      ) : (
        <AppButton
          label="SIMULATE IMPACT FORCE"
          variant="critical"
          onPress={() => simulateImpact(onAutoTrigger)}
          disabled={state !== ANOMALY_STATES.NORMAL}
        />
      )}
    </View>
  );
}

function Tile({ label, value, alert }) {
  return (
    <View style={[styles.tile, alert && styles.tileAlert]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, alert && styles.tileValueAlert]}>{value}</Text>
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
  title: { ...tokens.typography.caption, color: tokens.color.primaryBright, marginBottom: tokens.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  tile: {
    width: '48%',
    backgroundColor: tokens.color.bg2,
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  tileAlert: { borderColor: tokens.color.critical, backgroundColor: 'rgba(220,38,38,0.08)' },
  tileLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, fontSize: 9 },
  tileValue: { color: tokens.color.text, fontWeight: '800', marginTop: 6, fontSize: 14 },
  tileValueAlert: { color: tokens.color.critical },
  countdownBox: { alignItems: 'center', gap: tokens.spacing.sm },
  countdownLabel: { color: tokens.color.critical, fontWeight: '800', fontSize: 11, letterSpacing: 0.8 },
  countdownValue: { color: tokens.color.text, fontSize: 36, fontWeight: '900' },
});
