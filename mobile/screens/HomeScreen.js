import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  AppState,
} from 'react-native';
import { apiClient } from '../services/apiClient';
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DisarmModal from '../components/DisarmModal';
import { API_BASE_URL } from '../constants/config';
import {
  GEOFENCE_RADIUS_MIN_M,
  GEOFENCE_RADIUS_MAX_M,
} from '../constants/config';
import {
  registerLocationStoreAccessor,
  requestLocationPermissions,
  startBackgroundTracking,
  stopBackgroundTracking,
  disarmLocalWarning,
  setLocationCallbacks,
  getCurrentPosition,
  restoreMonitoringAfterReboot,
} from '../services/locationTracker';
import { connectSocket, disconnectSocket, emitTriggerEmergency } from '../services/socketService';
import { fetchTransitRoutes, geocodeDestination } from '../services/routeService';
import { buildSessionPinPayload } from '../utils/pinCrypto';
import { SYSTEM_STATES, useSafetyStore } from '../store/useSafetyStore';
import { useSOSDispatch } from '../hooks/useSOSDispatch';
import { useSOSFlowStore } from '../store/useSOSFlowStore';
import { useContactsStore } from '../store/useContactsStore';
import { useAuthStore } from '../store/useAuthStore';
import { SOS_STATES } from '../theme/tokens';
import AlertStatusPanel from '../components/AlertStatusPanel';
import IncidentStatusPanel from '../components/IncidentStatusPanel';

const { height: SCREEN_H } = Dimensions.get('window');

const COLORS = {
  bg: '#0F172A',
  slate: '#1E293B',
  border: '#334155',
  text: '#F8FAFC',
  muted: '#94A3B8',
  emerald: '#10B981',
  amber: '#F59E0B',
  crimson: '#EF4444',
};

const STATUS_META = {
  IDLE: { label: 'STANDBY', color: COLORS.muted },
  MONITORING: { label: 'MONITORING', color: COLORS.emerald },
  WARNING: { label: 'WARNING', color: COLORS.amber },
  EMERGENCY: { label: 'EMERGENCY', color: COLORS.crimson },
  DURESS_ACTIVE: { label: 'EMERGENCY', color: COLORS.crimson },
  DISARMED: { label: 'DISARMED', color: COLORS.muted },
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
];

function HoldSOSButton({ onActivate, disabled }) {
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);
  const HOLD_MS = 1500;

  const startHold = () => {
    if (disabled) return;
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start();
    holdTimer.current = setTimeout(() => {
      progress.setValue(0);
      onActivate?.();
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    Animated.timing(progress, { toValue: 0, duration: 120, useNativeDriver: false }).start();
  };

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled}
      style={[sosStyles.btn, disabled && sosStyles.btnDisabled]}
    >
      <Animated.View style={[sosStyles.fill, { width }]} />
      <Text style={sosStyles.label}>HOLD 1.5s · INSTANT SOS</Text>
    </Pressable>
  );
}

const sosStyles = StyleSheet.create({
  btn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#7F1D1D',
    borderWidth: 2,
    borderColor: COLORS.crimson,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  btnDisabled: { opacity: 0.45 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.crimson,
    opacity: 0.55,
  },
  label: {
    color: '#FFF',
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 14,
  },
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const store = useSafetyStore();
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [showDisarmModal, setShowDisarmModal] = useState(false);
  const [activeTab, setActiveTab] = useState('GEOFENCE');
  const [duressPinInput, setDuressPinInput] = useState('');
  const [drawerExpanded, setDrawerExpanded] = useState(true);
  const drawerHeight = useRef(new Animated.Value(SCREEN_H * 0.46)).current;
  const { dispatchSOS, cancelAlert } = useSOSDispatch();
  const sosState = useSOSFlowStore((s) => s.sosState);
  const flow = useSOSFlowStore();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [serverReachable, setServerReachable] = useState(null);

  useEffect(() => {
    useContactsStore.getState().loadContacts(userId);
  }, [userId]);

  useEffect(() => {
    const check = () =>
      apiClient
        .probeBackend()
        .then(() => setServerReachable(true))
        .catch(() => setServerReachable(false));
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  useEffect(() => {
    registerLocationStoreAccessor(() => useSafetyStore.getState);
    store.loadProfile();
    restoreMonitoringAfterReboot();

    setLocationCallbacks({
      onWarningStart: ({ message, countdownSeconds, reason }) => {
        store.startWarning(message, countdownSeconds, reason);
        setShowDisarmModal(true);
      },
      onCountdownTick: (seconds) => store.updateCountdown(seconds),
      onWarningClear: () => store.clearWarning(),
      onEmergency: () => {
        store.triggerEmergency();
        setShowDisarmModal(true);
      },
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  const statusMeta = STATUS_META[store.systemState] || STATUS_META.IDLE;

  const region = useMemo(() => {
    const loc = store.currentLocation || store.geofenceCenter;
    if (!loc) {
      return { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    }
    return { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
  }, [store.currentLocation, store.geofenceCenter]);

  const toggleDrawer = () => {
    const next = !drawerExpanded;
    setDrawerExpanded(next);
    Animated.spring(drawerHeight, {
      toValue: next ? SCREEN_H * 0.46 : 120,
      useNativeDriver: false,
      damping: 18,
    }).start();
  };

  const ensureProfile = () => {
    if (!store.userPhone || !store.contact1 || !store.contact2) {
      Alert.alert('Setup Required', 'Add your phone number and two emergency contacts.');
      return false;
    }
    if (!store.regularPin || store.regularPin.length !== 4) {
      Alert.alert('Setup Required', 'Set a 4-digit regular disarm PIN.');
      return false;
    }
    if (!duressPinInput || duressPinInput.length !== 4) {
      Alert.alert('Setup Required', 'Set a 4-digit duress PIN (used only at session start — never stored locally).');
      return false;
    }
    return true;
  };

  const startSessionOnServer = async (payload, standardPin, duressPin) => {
    const pinPayload = await buildSessionPinPayload(standardPin, duressPin);

    const response = await fetch(`${API_BASE_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        userPhone: store.userPhone,
        contact1: store.contact1,
        contact2: store.contact2,
        pinSalt: pinPayload.pinSalt,
        standardPinHash: pinPayload.standardPinHash,
        duressPinHash: pinPayload.duressPinHash,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to start session');
    }

    return response.json();
  };

  const bindSession = async (session, mode, trackingConfig) => {
    store.setSession(session.sessionId, session.trackingUrl, mode);
    store.setSessionCredentials({
      pinSalt: session.pinSalt,
      disarmToken: session.disarmToken,
      trackingUrl: session.trackingUrl,
    });

    connectSocket(session.sessionId, {
      onEmergencyAck: () => store.triggerEmergency(),
      onError: (e) => console.warn('[Socket]', e.message),
    });

    await startBackgroundTracking({ sessionId: session.sessionId, ...trackingConfig });
    await store.persistActiveSession({
      sessionId: session.sessionId,
      mode,
      ...trackingConfig,
    });
  };

  const handleStartGeofence = async () => {
    if (!ensureProfile()) return;

    setLoading(true);
    try {
      await requestLocationPermissions();
      const position = await getCurrentPosition();
      const center = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      store.setGeofence(center, store.geofenceRadiusM, store.geofenceTimerMinutes);
      store.setCurrentLocation(center);

      const session = await startSessionOnServer(
        {
          mode: 'GEOFENCE',
          geofence: {
            center,
            radiusMeters: store.geofenceRadiusM,
            timerMinutes: store.geofenceTimerMinutes,
          },
          initialLocation: center,
        },
        store.regularPin,
        duressPinInput
      );

      await bindSession(session, 'GEOFENCE', {
        mode: 'GEOFENCE',
        geofence: { center, radiusMeters: store.geofenceRadiusM },
      });

      setDuressPinInput('');
      await store.persistProfile();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTransit = async () => {
    if (!ensureProfile()) return;
    if (!destinationQuery.trim()) {
      Alert.alert('Destination Required', 'Enter your destination.');
      return;
    }

    setLoading(true);
    try {
      await requestLocationPermissions();
      const position = await getCurrentPosition();
      const origin = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const destination = await geocodeDestination(destinationQuery.trim());
      const routeResults = await fetchTransitRoutes(origin, destination);

      store.setCurrentLocation(origin);
      store.setTransit(destination, routeResults);

      const session = await startSessionOnServer(
        {
          mode: 'TRANSIT',
          destination,
          routes: routeResults.map((r) => r.polyline),
          initialLocation: origin,
        },
        store.regularPin,
        duressPinInput
      );

      await bindSession(session, 'TRANSIT', {
        mode: 'TRANSIT',
        routes: routeResults,
      });

      setDuressPinInput('');
      await store.persistProfile();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    setLoading(true);
    try {
      await stopBackgroundTracking();
      disconnectSocket();
      await store.clearActiveSessionStorage();
      store.clearSession();
      setShowDisarmModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSOS = () => {
    if (store.sessionId) {
      emitTriggerEmergency(store.sessionId, 'MANUAL_SOS');
      store.triggerEmergency();
      setShowDisarmModal(true);
      return;
    }
    // No monitoring session: save the SOS on the phone first, then send it (or queue it) via the account API.
    if (sosState === SOS_STATES.IDLE) dispatchSOS();
  };

  const handleDisarmSuccess = useCallback(async () => {
    disarmLocalWarning();
    store.clearWarning();
    await handleStopMonitoring();
  }, []);

  const isMonitoring =
    store.systemState === SYSTEM_STATES.MONITORING ||
    store.systemState === SYSTEM_STATES.WARNING;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        customMapStyle={DARK_MAP_STYLE}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
      >
        {store.geofenceCenter && store.mode === 'GEOFENCE' ? (
          <>
            <Marker coordinate={store.geofenceCenter} pinColor={COLORS.emerald} />
            <Circle
              center={store.geofenceCenter}
              radius={store.geofenceRadiusM}
              strokeColor="rgba(16, 185, 129, 0.85)"
              fillColor="rgba(16, 185, 129, 0.12)"
            />
          </>
        ) : null}

        {store.destination && store.mode === 'TRANSIT' ? (
          <Marker coordinate={store.destination} title="Destination" pinColor="#3B82F6" />
        ) : null}

        {store.routes?.map((route, idx) =>
          route.polyline?.length ? (
            <Polyline
              key={route.id || idx}
              coordinates={route.polyline}
              strokeColor={idx === 0 ? '#3B82F6' : '#6366F1'}
              strokeWidth={5}
            />
          ) : null
        )}
      </MapView>

      <SafeAreaView style={styles.topHud} edges={['top']} pointerEvents="box-none">
        <View style={styles.brandRow}>
          <Text style={styles.brand}>SOS-Vidha</Text>
          <View style={[styles.badge, { borderColor: statusMeta.color }]}>
            <View style={[styles.badgeDot, { backgroundColor: statusMeta.color }]} />
            <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        {store.countdownSeconds != null ? (
          <View style={styles.countdownChip}>
            <Text style={styles.countdownText}>{store.countdownSeconds}s to respond</Text>
          </View>
        ) : null}

        {store.warningMessage ? (
          <View style={styles.warningChip}>
            <Text style={styles.warningText}>{store.warningMessage}</Text>
          </View>
        ) : null}

        {serverReachable === false ? (
          <View style={styles.warningChip}>
            <Text style={styles.warningText}>
              OFFLINE MAP UNAVAILABLE · No connection. SOS-Vidha has no offline map; any map shown is your phone's own
              cache and may be incomplete. Live tracking is not updating.
            </Text>
          </View>
        ) : null}

        {!store.currentLocation ? (
          <View style={styles.infoChip}>
            <Text style={styles.infoChipText}>No GPS fix yet. The map is not centred on your position.</Text>
          </View>
        ) : null}
      </SafeAreaView>

      <Animated.View style={[styles.drawer, { height: drawerHeight, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.drawerHandle} onPress={toggleDrawer} activeOpacity={0.8}>
          <View style={styles.handleBar} />
        </TouchableOpacity>

        <View style={styles.tabRow}>
          {['GEOFENCE', 'TRANSIT'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                {tab === 'GEOFENCE' ? 'Safe Zone' : 'Transit Safeguard'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Emergency Profile</Text>
          <TextInput
            style={styles.input}
            placeholder="Your phone (+91...)"
            placeholderTextColor="#64748B"
            value={store.userPhone}
            onChangeText={(v) => store.setContacts(v, store.contact1, store.contact2)}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Guardian 1"
            placeholderTextColor="#64748B"
            value={store.contact1}
            onChangeText={(v) => store.setContacts(store.userPhone, v, store.contact2)}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Guardian 2"
            placeholderTextColor="#64748B"
            value={store.contact2}
            onChangeText={(v) => store.setContacts(store.userPhone, store.contact1, v)}
            keyboardType="phone-pad"
          />

          <View style={styles.pinRow}>
            <TextInput
              style={[styles.input, styles.pinField]}
              placeholder="Regular PIN"
              placeholderTextColor="#64748B"
              value={store.regularPin}
              onChangeText={(v) => store.setRegularPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <TextInput
              style={[styles.input, styles.pinField]}
              placeholder="Duress PIN (session)"
              placeholderTextColor="#64748B"
              value={duressPinInput}
              onChangeText={(v) => setDuressPinInput(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </View>

          {activeTab === 'GEOFENCE' ? (
            <>
              <Text style={styles.sectionLabel}>Safe Zone · {store.geofenceRadiusM}m radius</Text>
              <Slider
                style={styles.slider}
                minimumValue={GEOFENCE_RADIUS_MIN_M}
                maximumValue={GEOFENCE_RADIUS_MAX_M}
                step={100}
                value={store.geofenceRadiusM}
                onValueChange={(v) =>
                  store.setGeofence(store.geofenceCenter, Math.round(v), store.geofenceTimerMinutes)
                }
                minimumTrackTintColor={COLORS.emerald}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.emerald}
              />
              <View style={styles.timerRow}>
                {[15, 30, 60, 120].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.timerChip, store.geofenceTimerMinutes === mins && styles.timerChipActive]}
                    onPress={() =>
                      store.setGeofence(store.geofenceCenter, store.geofenceRadiusM, mins)
                    }
                  >
                    <Text style={styles.timerChipText}>{mins}m</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, isMonitoring && styles.actionBtnDisabled]}
                onPress={handleStartGeofence}
                disabled={loading || isMonitoring}
              >
                {loading ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.actionBtnText}>Activate Safe Zone</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Transit Safeguard</Text>
              <TextInput
                style={styles.input}
                placeholder="Search destination..."
                placeholderTextColor="#64748B"
                value={destinationQuery}
                onChangeText={setDestinationQuery}
              />
              <TouchableOpacity
                style={[styles.actionBtn, isMonitoring && styles.actionBtnDisabled]}
                onPress={handleStartTransit}
                disabled={loading || isMonitoring}
              >
                {loading ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.actionBtnText}>Start Route Monitor</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {isMonitoring ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowDisarmModal(true)}>
              <Text style={styles.secondaryBtnText}>Disarm / End Session</Text>
            </TouchableOpacity>
          ) : null}

          <HoldSOSButton
            onActivate={handleManualSOS}
            disabled={!store.sessionId && sosState !== SOS_STATES.IDLE}
          />
          {sosState === SOS_STATES.DISPATCHING ? (
            <Text style={styles.dispatchingText}>Saving SOS on this phone and sending…</Text>
          ) : null}

          {sosState === SOS_STATES.ACTIVE_ALERT ? (
            <View style={styles.alertBlock}>
              <AlertStatusPanel
                deliveries={flow.deliveries}
                alertsMode={flow.alertsMode}
                alertLocation={flow.alertLocation}
                followUpError={flow.followUpError}
                alertStatusError={flow.alertStatusError}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={cancelAlert}>
                <Text style={styles.secondaryBtnText}>Stop SOS alert</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {flow.dispatchError ? <Text style={styles.dispatchError}>{flow.dispatchError}</Text> : null}

          <IncidentStatusPanel
            dark
            hideIncidentId={sosState === SOS_STATES.ACTIVE_ALERT ? flow.localIncidentId : null}
          />
        </ScrollView>
      </Animated.View>

      <DisarmModal
        visible={showDisarmModal}
        sessionId={store.sessionId}
        pinSalt={store.pinSalt}
        disarmToken={store.disarmToken}
        onDisarmSuccess={handleDisarmSuccess}
        onClose={() => setShowDisarmModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.8 },
  countdownChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  countdownText: { color: '#0F172A', fontWeight: '800' },
  warningChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.88)',
    borderRadius: 12,
    padding: 10,
  },
  warningText: { color: '#0F172A', fontWeight: '700' },
  infoChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoChipText: { color: COLORS.muted, fontWeight: '600', fontSize: 12 },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  drawerHandle: { alignItems: 'center', paddingVertical: 10 },
  handleBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#475569',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.slate,
    borderRadius: 14,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.border },
  tabLabel: { color: COLORS.muted, fontWeight: '600', fontSize: 13 },
  tabLabelActive: { color: COLORS.text },
  drawerScroll: { flex: 1, paddingHorizontal: 16 },
  sectionLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.slate,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    marginBottom: 8,
  },
  pinRow: { flexDirection: 'row', gap: 8 },
  pinField: { flex: 1 },
  slider: { width: '100%', height: 36, marginBottom: 8 },
  timerRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  timerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.slate,
  },
  timerChipActive: { borderColor: COLORS.emerald, backgroundColor: 'rgba(16,185,129,0.15)' },
  timerChipText: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  actionBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnText: { color: '#0F172A', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: COLORS.muted, fontWeight: '700' },
  dispatchingText: { color: COLORS.amber, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  dispatchError: { color: COLORS.crimson, fontWeight: '700', marginTop: 8 },
  alertBlock: { marginTop: 12 },
});
