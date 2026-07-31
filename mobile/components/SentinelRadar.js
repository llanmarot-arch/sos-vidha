import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import LiveMap from './LiveMap';
import AppButton from './AppButton';
import { tokens } from '../theme/tokens';
import { useSentinelStore } from '../store/useSentinelStore';
import Slider from '@react-native-community/slider';

export default function SentinelRadar({ latitude = 28.6139, longitude = 77.209 }) {
  const activeSentinels = useSentinelStore((s) => s.activeSentinels);
  const privacyRadiusM = useSentinelStore((s) => s.privacyRadiusM);
  const broadcastEnabled = useSentinelStore((s) => s.broadcastEnabled);
  const nearbyPings = useSentinelStore((s) => s.nearbyPings);
  const loadSettings = useSentinelStore((s) => s.loadSettings);
  const setPrivacyRadius = useSentinelStore((s) => s.setPrivacyRadius);
  const setBroadcastEnabled = useSentinelStore((s) => s.setBroadcastEnabled);
  const sendPing = useSentinelStore((s) => s.sendPing);
  const checkIn = useSentinelStore((s) => s.checkIn);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapWrap}>
        <LiveMap latitude={latitude} longitude={longitude} accuracy={privacyRadiusM} heartbeat={activeSentinels} />
        <View style={styles.radarOverlay}>
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMid]} />
          <View style={[styles.ring, styles.ringInner]} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="ACTIVE SENTINELS" value={String(activeSentinels)} />
        <Stat label="PRIVACY RADIUS" value={`${privacyRadiusM}m`} />
      </View>

      <Text style={styles.sliderLabel}>DISTANCE MASKING · {privacyRadiusM}m</Text>
      <Slider
        style={styles.slider}
        minimumValue={50}
        maximumValue={500}
        step={25}
        value={privacyRadiusM}
        onValueChange={(v) => setPrivacyRadius(Math.round(v))}
        minimumTrackTintColor={tokens.color.primaryBright}
        maximumTrackTintColor={tokens.color.border}
        thumbTintColor={tokens.color.primaryBright}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>ANONYMOUS DISTRESS BROADCAST</Text>
        <Switch
          value={broadcastEnabled}
          onValueChange={setBroadcastEnabled}
          trackColor={{ false: tokens.color.border, true: tokens.color.primary }}
          thumbColor={tokens.color.text}
        />
      </View>

      <View style={styles.actions}>
        <AppButton label="SEND PEER PING" variant="primary" onPress={sendPing} />
        <AppButton label="COMMUNITY CHECK-IN" variant="ghost" onPress={checkIn} />
      </View>

      {nearbyPings.length > 0 ? (
        <View style={styles.pingList}>
          <Text style={styles.pingTitle}>RECENT MESH SIGNALS</Text>
          {nearbyPings.slice(0, 4).map((ping) => (
            <Text key={ping.id} style={styles.pingItem}>
              SIGNAL · {ping.distanceM}m · MASKED · {new Date(ping.timestamp).toLocaleTimeString()}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  mapWrap: { height: 260, borderRadius: tokens.radius.lg, overflow: 'hidden', position: 'relative', marginBottom: tokens.spacing.md },
  radarOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(2,195,154,0.35)', borderRadius: 999 },
  ringOuter: { width: 220, height: 220 },
  ringMid: { width: 150, height: 150, borderColor: 'rgba(0,168,150,0.45)' },
  ringInner: { width: 80, height: 80, borderColor: 'rgba(0,128,128,0.65)' },
  statsRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  stat: { flex: 1, backgroundColor: tokens.color.surface, borderRadius: tokens.radius.sm, padding: tokens.spacing.md, borderWidth: 1, borderColor: tokens.color.border },
  statLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, fontSize: 9 },
  statValue: { color: tokens.color.primaryBright, fontWeight: '800', fontSize: 18, marginTop: 4 },
  sliderLabel: { ...tokens.typography.caption, color: tokens.color.textMuted, marginBottom: 4 },
  slider: { width: '100%', height: 36, marginBottom: tokens.spacing.md },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.md },
  toggleLabel: { color: tokens.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5, flex: 1, marginRight: 12 },
  actions: { gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  pingList: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.md, padding: tokens.spacing.md, borderWidth: 1, borderColor: tokens.color.border },
  pingTitle: { ...tokens.typography.caption, color: tokens.color.textSubtle, marginBottom: tokens.spacing.sm },
  pingItem: { ...tokens.typography.mono, color: tokens.color.textMuted, marginBottom: 4, fontSize: 11 },
});
