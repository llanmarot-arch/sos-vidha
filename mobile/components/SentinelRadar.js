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
        <Stat label="People nearby" value={String(activeSentinels)} />
        <Stat label="Location hidden within" value={`${privacyRadiusM} m`} />
      </View>

      <View style={styles.card}>
        <View style={styles.sliderHead}>
          <Text style={styles.sliderLabel}>Hide my exact location within</Text>
          <Text style={styles.sliderValue}>{privacyRadiusM} m</Text>
        </View>
        <Text style={styles.helpText}>A bigger area gives you more privacy.</Text>
        <Slider
          style={styles.slider}
          accessibilityLabel="Hide my exact location within"
          accessibilityValue={{ text: `${privacyRadiusM} metres` }}
          minimumValue={50}
          maximumValue={500}
          step={25}
          value={privacyRadiusM}
          onValueChange={(v) => setPrivacyRadius(Math.round(v))}
          minimumTrackTintColor={tokens.color.primary}
          maximumTrackTintColor={tokens.color.borderStrong}
          thumbTintColor={tokens.color.primary}
        />
      </View>

      <View style={[styles.card, styles.toggleRow]}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>Ask nearby people for help</Text>
          <Text style={styles.helpText}>Sends an anonymous alert when you start SOS.</Text>
        </View>
        <Switch
          value={broadcastEnabled}
          onValueChange={setBroadcastEnabled}
          accessibilityLabel="Ask nearby people for help"
          trackColor={{ false: tokens.color.borderStrong, true: tokens.color.primary }}
          thumbColor={tokens.color.onPrimary}
          activeThumbColor={tokens.color.onPrimary}
        />
      </View>

      <View style={styles.actions}>
        <AppButton label="Alert people nearby" variant="primary" onPress={sendPing} />
        <AppButton label="Tell nearby people I'm safe" variant="ghost" onPress={checkIn} />
      </View>

      {nearbyPings.length > 0 ? (
        <View style={styles.pingList}>
          <Text style={styles.pingTitle} accessibilityRole="header" aria-level={2}>
            Recent alerts nearby
          </Text>
          {nearbyPings.slice(0, 4).map((ping) => (
            <Text key={ping.id} style={styles.pingItem}>
              About {ping.distanceM} m away · {new Date(ping.timestamp).toLocaleTimeString()}
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
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(31,79,191,0.25)', borderRadius: 999 },
  ringOuter: { width: 220, height: 220 },
  ringMid: { width: 150, height: 150, borderColor: 'rgba(31,79,191,0.4)' },
  ringInner: { width: 80, height: 80, borderColor: 'rgba(31,79,191,0.6)' },
  statsRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  stat: { flex: 1, backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.md, borderWidth: 1, borderColor: tokens.color.border },
  statLabel: { color: tokens.color.textSubtle, fontSize: 14, lineHeight: 20 },
  statValue: { color: tokens.color.primary, fontWeight: '700', fontSize: 22, marginTop: 4 },
  card: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, borderWidth: 1, borderColor: tokens.color.border, marginBottom: tokens.spacing.sm },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm },
  sliderLabel: { color: tokens.color.text, fontWeight: '700', fontSize: 16, flex: 1 },
  sliderValue: { color: tokens.color.primary, fontWeight: '700', fontSize: 16 },
  helpText: { color: tokens.color.textSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  slider: { width: '100%', height: 44, marginTop: tokens.spacing.sm },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { color: tokens.color.text, fontWeight: '700', fontSize: 16 },
  actions: { gap: tokens.spacing.sm, marginVertical: tokens.spacing.md },
  pingList: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, borderWidth: 1, borderColor: tokens.color.border },
  pingTitle: { ...tokens.typography.title, color: tokens.color.text, marginBottom: tokens.spacing.sm },
  pingItem: { color: tokens.color.textMuted, marginBottom: 6, fontSize: 15 },
});
