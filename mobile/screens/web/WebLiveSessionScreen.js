import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import LiveMap from '../../components/LiveMap';
import BlackBoxPanel from '../../components/BlackBoxPanel';
import LiveLocationSharePanel from '../../components/LiveLocationSharePanel';
import { tokens } from '../../theme/tokens';
import { useSOSFlowStore } from '../../store/useSOSFlowStore';
import { useBlackBoxStore } from '../../store/useBlackBoxStore';
import { useContactsStore } from '../../store/useContactsStore';
import { isMockFallbackActive } from '../../services/apiClient';
import {
  subscribeLocation,
  startLiveTracking,
  getElapsedLabel,
  requestLocationPermissions,
  setStreamSessionId,
} from '../../services/webLocationService';
import { LoadingState } from '../../components/UiStates';
import { SOS_STATES } from '../../theme/tokens';

function TelemetryRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function WebLiveSessionScreen() {
  const sessionId = useSOSFlowStore((s) => s.sessionId);
  const trackingUrl = useSOSFlowStore((s) => s.trackingUrl);
  const alertStartedAt = useSOSFlowStore((s) => s.alertStartedAt);
  const sosState = useSOSFlowStore((s) => s.sosState);
  const recording = useBlackBoxStore((s) => s.recording);
  const contacts = useContactsStore((s) => s.contacts);
  const loadContacts = useContactsStore((s) => s.loadContacts);
  const [location, setLocation] = useState(null);
  const [heartbeat, setHeartbeat] = useState(0);
  const [elapsed, setElapsed] = useState('00:00');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      await requestLocationPermissions();
      if (sessionId) setStreamSessionId(sessionId);
      await startLiveTracking(sessionId || undefined);
      if (mounted) setLoading(false);
    })();

    const unsub = subscribeLocation((loc) => {
      setLocation(loc);
      setHeartbeat((h) => h + 1);
    });

    const timer = setInterval(() => setElapsed(getElapsedLabel(alertStartedAt)), 1000);
    return () => {
      mounted = false;
      unsub();
      clearInterval(timer);
    };
  }, [sessionId, alertStartedAt]);

  if (loading) return <LoadingState message="LOADING TELEMETRY CHANNEL…" />;

  const isActive = Boolean(sessionId) || sosState === SOS_STATES.ACTIVE_ALERT;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="LIVE LOCATION"
        subtitle={`HEARTBEAT #${heartbeat} · ${isActive ? `ELAPSED ${elapsed}` : 'PREVIEW MODE'}`}
        status={isActive ? 'TELEMETRY SHARED' : 'GPS ACTIVE'}
      />

      <View style={styles.mapWrap}>
        {location ? (
          <LiveMap
            latitude={location.latitude}
            longitude={location.longitude}
            accuracy={location.accuracy}
            heartbeat={heartbeat}
          />
        ) : (
          <LoadingState message="ACQUIRING GPS FIX…" />
        )}
      </View>

      <LiveLocationSharePanel
        location={location}
        sessionId={sessionId}
        trackingUrl={trackingUrl}
        contacts={contacts}
      />

      {isActive ? (
        <View style={styles.broadcastCard}>
          <Text style={styles.broadcastLabel}>GUARDIAN BROADCAST</Text>
          <Text style={styles.broadcastValue}>ACTIVE · WHATSAPP DISPATCHED ON SOS</Text>
          {trackingUrl ? <Text style={styles.trackUrl} numberOfLines={2}>{trackingUrl}</Text> : null}
          {isMockFallbackActive() ? (
            <Text style={styles.mockNote}>MOCK ADAPTER · LOCAL SESSION SIMULATION</Text>
          ) : null}
        </View>
      ) : null}

      {location ? (
        <View style={styles.telemetry}>
          <TelemetryRow label="LATITUDE" value={location.latitude.toFixed(6)} />
          <TelemetryRow label="LONGITUDE" value={location.longitude.toFixed(6)} />
          <TelemetryRow label="ALTITUDE" value={`${(location.altitude ?? 0).toFixed(1)} m`} />
          <TelemetryRow label="ACCURACY" value={`±${location.accuracy?.toFixed?.(0) ?? '—'} m`} />
          <TelemetryRow label="BATTERY" value={location.batteryLevel != null ? `${Math.round(location.batteryLevel * 100)}%` : '—'} />
          <TelemetryRow label="SIGNAL" value={location.signalQuality || '—'} />
          <TelemetryRow label="SPEED" value={`${((location.speed ?? 0) * 3.6).toFixed(1)} km/h`} />
          <TelemetryRow label="LAST FIX" value={new Date(location.timestamp).toLocaleTimeString()} />
        </View>
      ) : null}

      {isActive ? <BlackBoxPanel /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 110 },
  broadcastCard: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.primary,
  },
  broadcastLabel: { ...tokens.typography.caption, color: tokens.color.primaryBright },
  broadcastValue: { color: tokens.color.text, fontWeight: '800', marginTop: 4, fontSize: 14 },
  trackUrl: { ...tokens.typography.mono, color: tokens.color.textMuted, marginTop: 6, fontSize: 11 },
  mockNote: { color: tokens.color.textSubtle, fontSize: 10, marginTop: 6, letterSpacing: 0.5 },
  mapWrap: { height: 280, borderRadius: tokens.radius.lg, overflow: 'hidden', marginBottom: tokens.spacing.lg },
  telemetry: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    marginBottom: tokens.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  rowLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, fontSize: 9 },
  rowValue: { color: tokens.color.text, fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
});
