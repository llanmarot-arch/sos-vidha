import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import LiveMap from './LiveMap';
import AppButton from './AppButton';
import { useThemedStyles } from '../theme/useTheme';
import { useSentinelStore } from '../store/useSentinelStore';
import Slider from '@react-native-community/slider';

export default function SentinelRadar({ latitude, longitude }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const privacyRadiusM = useSentinelStore((s) => s.privacyRadiusM);
  const broadcastEnabled = useSentinelStore((s) => s.broadcastEnabled);
  const unavailableNote = useSentinelStore((s) => s.unavailableNote);
  const loadSettings = useSentinelStore((s) => s.loadSettings);
  const setPrivacyRadius = useSentinelStore((s) => s.setPrivacyRadius);
  const setBroadcastEnabled = useSentinelStore((s) => s.setBroadcastEnabled);
  const sendPing = useSentinelStore((s) => s.sendPing);
  const checkIn = useSentinelStore((s) => s.checkIn);
  const hasFix = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapWrap}>
        {hasFix ? (
          <LiveMap latitude={latitude} longitude={longitude} accuracy={privacyRadiusM} />
        ) : (
          <View style={styles.mapMissing}>
            <Text style={styles.helpText}>No GPS fix from this device. The map stays blank until one arrives.</Text>
          </View>
        )}
        <View style={styles.radarOverlay}>
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMid]} />
          <View style={[styles.ring, styles.ringInner]} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="People nearby" value="Not available" />
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
          minimumTrackTintColor={theme.color.accentOnSurface}
          maximumTrackTintColor={theme.color.borderStrong}
          thumbTintColor={theme.color.accentOnSurface}
        />
      </View>

      <View style={[styles.card, styles.toggleRow]}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>Ask nearby people for help</Text>
          <Text style={styles.helpText}>Nearby-user alerts are not connected, so this switch does not send anything.</Text>
        </View>
        <Switch
          value={broadcastEnabled}
          onValueChange={setBroadcastEnabled}
          accessibilityLabel="Ask nearby people for help"
          trackColor={{ false: theme.color.borderStrong, true: theme.color.accentOnSurface }}
          thumbColor={theme.color.controlThumb}
          activeThumbColor={theme.color.controlThumb}
        />
      </View>

      <View style={styles.actions}>
        <AppButton label="Alert people nearby" variant="primary" onPress={sendPing} />
        <AppButton label="Tell nearby people I'm safe" variant="ghost" onPress={checkIn} />
      </View>

      {unavailableNote ? <Text style={styles.helpText}>{unavailableNote}</Text> : null}
    </View>
  );
}

function Stat({ label, value }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function createStyles(theme) {
  return {
  wrap: { flex: 1 },
  mapWrap: { height: 260, borderRadius: theme.radius.lg, overflow: 'hidden', position: 'relative', marginBottom: theme.spacing.md },
  mapMissing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.color.bg0 },
  radarOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: theme.color.accentOnSurface, borderRadius: 999, opacity: 0.35 },
  ringOuter: { width: 220, height: 220 },
  ringMid: { width: 150, height: 150, opacity: 0.55 },
  ringInner: { width: 80, height: 80, opacity: 0.8 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  stat: { flex: 1, backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  statLabel: { color: theme.color.textSubtle, fontSize: 14, lineHeight: 20 },
  statValue: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 22, marginTop: 4 },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border, marginBottom: theme.spacing.sm },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  sliderLabel: { color: theme.color.text, fontWeight: '700', fontSize: 16, flex: 1 },
  sliderValue: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16 },
  helpText: { color: theme.color.textSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  slider: { width: '100%', height: 44, marginTop: theme.spacing.sm },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { color: theme.color.text, fontWeight: '700', fontSize: 16 },
  actions: { gap: theme.spacing.sm, marginVertical: theme.spacing.md },
  pingList: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border },
  pingTitle: { ...theme.typography.title, color: theme.color.text, marginBottom: theme.spacing.sm },
  pingItem: { color: theme.color.textMuted, marginBottom: 6, fontSize: 15 },
  };
}
