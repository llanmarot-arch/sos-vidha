import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import LiveMap from '../../components/LiveMap';
import BlackBoxPanel from '../../components/BlackBoxPanel';
import LiveLocationSharePanel from '../../components/LiveLocationSharePanel';
import { useThemedStyles } from '../../theme/useTheme';
import { useSOSFlowStore } from '../../store/useSOSFlowStore';
import { useBlackBoxStore } from '../../store/useBlackBoxStore';
import { useContactsStore } from '../../store/useContactsStore';
import { isMockFallbackActive } from '../../services/apiClient';
import {
  subscribeLocation,
  subscribeLocationError,
  startLiveTracking,
  getElapsedLabel,
  requestLocationPermissions,
  setStreamSessionId,
} from '../../services/webLocationService';
import { LoadingState } from '../../components/UiStates';
import { SOS_STATES } from '../../theme/tokens';
import { describeLocationError } from '../../services/apiClientPolicy';
import { useI18n } from '../../i18n/useI18n';

const STALE_FIX_MS = 60 * 1000;

function formatFixAge(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} seconds`;
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${(s / 3600).toFixed(1)} hours`;
}

function TelemetryRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function WebLiveSessionScreen() {
  const { styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
  const sessionId = useSOSFlowStore((s) => s.sessionId);
  const trackingUrl = useSOSFlowStore((s) => s.trackingUrl);
  const alertStartedAt = useSOSFlowStore((s) => s.alertStartedAt);
  const sosState = useSOSFlowStore((s) => s.sosState);
  const recording = useBlackBoxStore((s) => s.recording);
  const contacts = useContactsStore((s) => s.contacts);
  const loadContacts = useContactsStore((s) => s.loadContacts);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [heartbeat, setHeartbeat] = useState(0);
  const [elapsed, setElapsed] = useState('00:00');
  const [loading, setLoading] = useState(true);
  // navigator.onLine === false is a reliable "offline"; true does not prove the server is reachable.
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return undefined;
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
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
      setLocationError(null);
      setHeartbeat((h) => h + 1);
    });
    const unsubError = subscribeLocationError((code) => setLocationError(code));

    const timer = setInterval(() => setElapsed(getElapsedLabel(alertStartedAt)), 1000);
    return () => {
      mounted = false;
      unsub();
      unsubError();
      clearInterval(timer);
    };
  }, [sessionId, alertStartedAt]);

  if (loading) return <LoadingState message={t('live.finding')} />;

  const isActive = Boolean(sessionId) || sosState === SOS_STATES.ACTIVE_ALERT;
  const fixAgeMs = location ? Date.now() - location.timestamp : null;
  const staleFix = fixAgeMs != null && fixAgeMs > STALE_FIX_MS;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader
        title={t('live.title')}
        subtitle={
          isActive
            ? offline
              ? t('live.sharingPaused')
              : t('live.sharingFor', { elapsed })
            : t('live.onlyYou')
        }
        status={isActive ? (offline ? t('live.notUpdating') : t('live.sharingLive')) : t('live.locationOn')}
      />

      {isActive && offline ? (
        <Text style={styles.staleNote} accessibilityRole="alert">
          No connection. Your contacts' tracking page is not updating; it shows only what was sent before the
          connection dropped.
        </Text>
      ) : null}

      {location && staleFix ? (
        <Text style={styles.staleNote}>
          Last GPS fix was {formatFixAge(fixAgeMs)} ago, at {new Date(location.timestamp).toLocaleTimeString()}. It may
          not show where you are now.
        </Text>
      ) : null}

      <View
        style={styles.mapWrap}
        role="region"
        aria-label={
          location
            ? location.accuracy != null
              ? `Map showing your location, accurate to about ${Math.round(location.accuracy)} metres`
              : 'Map showing your location'
            : 'Location unavailable'
        }
      >
        {location ? (
          <LiveMap
            latitude={location.latitude}
            longitude={location.longitude}
            accuracy={location.accuracy}
            heartbeat={heartbeat}
          />
        ) : locationError ? (
          <View style={styles.unavailable} accessibilityRole="alert">
            <Text style={styles.unavailableTitle}>Location unavailable</Text>
            <Text style={styles.unavailableText}>
              We could not get your position because {describeLocationError(locationError)}.
            </Text>
          </View>
        ) : (
          <LoadingState message="Finding your location…" />
        )}
      </View>

      {location && locationError ? (
        <Text style={styles.staleNote} accessibilityRole="alert">
          GPS stopped updating ({describeLocationError(locationError)}). The details below are from{' '}
          {new Date(location.timestamp).toLocaleTimeString()}.
        </Text>
      ) : null}

      <LiveLocationSharePanel
        location={location}
        sessionId={sessionId}
        trackingUrl={trackingUrl}
        contacts={contacts}
      />

      {isActive ? (
        <View style={styles.broadcastCard}>
          <Text style={styles.broadcastLabel} accessibilityRole="header" aria-level={2}>
            SOS is active
          </Text>
          <Text style={styles.broadcastValue}>
            Your contacts can follow this link while the SOS is on. See Home for the status of each message.
          </Text>
          {trackingUrl ? <Text style={styles.trackUrl} numberOfLines={2}>{trackingUrl}</Text> : null}
          {isMockFallbackActive() ? (
            <Text style={styles.mockNote}>Test mode: this alert is simulated.</Text>
          ) : null}
        </View>
      ) : null}

      {location ? (
        <View style={styles.telemetry}>
          <Text style={styles.telemetryTitle} accessibilityRole="header" aria-level={2}>
            Location details
          </Text>
          <TelemetryRow label="Latitude" value={location.latitude.toFixed(6)} />
          <TelemetryRow label="Longitude" value={location.longitude.toFixed(6)} />
          <TelemetryRow
            label="Accuracy"
            value={location.accuracy != null ? `about ${Math.round(location.accuracy)} m` : 'Not reported'}
          />
          <TelemetryRow
            label="Speed"
            value={location.speed != null ? `${(location.speed * 3.6).toFixed(1)} km/h` : 'Not reported'}
          />
          <TelemetryRow label="Battery" value={location.batteryLevel != null ? `${Math.round(location.batteryLevel * 100)}%` : 'Unknown'} />
          <TelemetryRow label="Last updated" value={new Date(location.timestamp).toLocaleTimeString()} />
        </View>
      ) : null}

      {isActive ? <BlackBoxPanel /> : null}
    </ScrollView>
  );
}

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  broadcastCard: {
    backgroundColor: theme.color.successSoft,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.success,
  },
  broadcastLabel: { ...theme.typography.title, color: theme.color.success },
  broadcastValue: { color: theme.color.text, marginTop: 4, fontSize: 16, lineHeight: 22 },
  trackUrl: { ...theme.typography.mono, color: theme.color.textMuted, marginTop: 6 },
  mockNote: { color: theme.color.textSubtle, fontSize: 14, marginTop: 6 },
  unavailable: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.color.warningSoft, gap: 6 },
  unavailableTitle: { ...theme.typography.title, color: theme.color.warning },
  unavailableText: { fontSize: 16, lineHeight: 22, color: theme.color.text },
  staleNote: { color: theme.color.warning, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.md },
  mapWrap: { height: 280, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border },
  telemetryTitle: { ...theme.typography.title, color: theme.color.text, marginBottom: theme.spacing.sm },
  telemetry: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowLabel: { color: theme.color.textMuted, fontSize: 15 },
  rowValue: { color: theme.color.text, fontWeight: '700', fontSize: 15 },
};
}
