import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOCATION_TASK_NAME,
  LOCATION_UPDATE_INTERVAL_MS,
  LOCATION_DISTANCE_INTERVAL_M,
  ZONE_EXIT_COUNTDOWN_SEC,
  ZONE_EXIT_FAST_COUNTDOWN_SEC,
  ROUTE_DEVIATION_THRESHOLD_M,
  ROUTE_DEVIATION_GRACE_MS,
  ROUTE_ACK_COUNTDOWN_SEC,
} from '../constants/config';
import {
  haversineDistanceM,
  isMovingAwayFromCenter,
  pointToRoutesDistanceM,
  GPSFilter,
} from '../utils/geo';
import { emitLocationUpdate, emitTriggerEmergency, getSocket } from './socketService';

const ACTIVE_SESSION_KEY = '@sosvidha/active_session';

let getStore = null;
const gpsFilter = new GPSFilter();

const monitorState = {
  mode: null,
  sessionId: null,
  geofence: null,
  routes: [],
  countdownTimer: null,
  countdownRemaining: 0,
  countdownReason: null,
  routeOffSince: null,
  lastLocation: null,
  warningActive: false,
  callbacks: {
    onWarningStart: null,
    onCountdownTick: null,
    onWarningClear: null,
    onEmergency: null,
  },
};

export function registerLocationStoreAccessor(storeGetter) {
  getStore = storeGetter;
}

export function setLocationCallbacks(callbacks) {
  monitorState.callbacks = { ...monitorState.callbacks, ...callbacks };
}

function emitClientStatus(status) {
  const socket = getSocket();
  if (socket?.connected && monitorState.sessionId) {
    socket.emit('client-status', { sessionId: monitorState.sessionId, status });
  }
}

function clearCountdown() {
  if (monitorState.countdownTimer) {
    clearInterval(monitorState.countdownTimer);
    monitorState.countdownTimer = null;
  }
  monitorState.countdownRemaining = 0;
  monitorState.countdownReason = null;
  monitorState.warningActive = false;
  monitorState.routeOffSince = null;
  emitClientStatus('MONITORING');
  monitorState.callbacks.onWarningClear?.();
}

function startCountdown(seconds, reason) {
  clearCountdown();
  monitorState.countdownRemaining = seconds;
  monitorState.countdownReason = reason;
  monitorState.warningActive = true;
  emitClientStatus('WARNING');

  monitorState.callbacks.onWarningStart?.({
    message:
      reason === 'ROUTE_DEVIATION'
        ? 'Are you taking an alternate route?'
        : 'You left your safe zone. Confirm you are safe.',
    countdownSeconds: seconds,
    reason,
  });

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

  monitorState.countdownTimer = setInterval(() => {
    monitorState.countdownRemaining -= 1;
    monitorState.callbacks.onCountdownTick?.(monitorState.countdownRemaining);

    if (monitorState.countdownRemaining <= 0) {
      clearCountdown();
      triggerEmergency(reason);
    }
  }, 1000);
}

function triggerEmergency(reason) {
  const sessionId = monitorState.sessionId;
  emitClientStatus('EMERGENCY');
  monitorState.callbacks.onEmergency?.(reason);
  if (sessionId) {
    emitTriggerEmergency(sessionId, reason);
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

function processGeofence(location) {
  const { geofence } = monitorState;
  if (!geofence) return;

  const distanceM = haversineDistanceM(
    location.latitude,
    location.longitude,
    geofence.center.latitude,
    geofence.center.longitude
  );

  if (distanceM <= geofence.radiusMeters) {
    if (monitorState.warningActive) clearCountdown();
    return;
  }

  if (monitorState.warningActive) {
    const movingAway = isMovingAwayFromCenter(
      location.latitude,
      location.longitude,
      location.speed,
      location.heading,
      geofence.center.latitude,
      geofence.center.longitude
    );

    if (movingAway && monitorState.countdownRemaining > ZONE_EXIT_FAST_COUNTDOWN_SEC) {
      monitorState.countdownRemaining = ZONE_EXIT_FAST_COUNTDOWN_SEC;
      monitorState.callbacks.onCountdownTick?.(monitorState.countdownRemaining);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    return;
  }

  startCountdown(ZONE_EXIT_COUNTDOWN_SEC, 'GEOFENCE_EXIT');
}

function processTransit(location) {
  const { routes } = monitorState;
  if (!routes?.length) return;

  const minDist = pointToRoutesDistanceM(location, routes);

  if (minDist <= ROUTE_DEVIATION_THRESHOLD_M) {
    monitorState.routeOffSince = null;
    if (monitorState.warningActive && monitorState.countdownReason === 'ROUTE_DEVIATION') {
      clearCountdown();
    }
    return;
  }

  const now = Date.now();
  if (!monitorState.routeOffSince) {
    monitorState.routeOffSince = now;
    return;
  }

  if (now - monitorState.routeOffSince >= ROUTE_DEVIATION_GRACE_MS && !monitorState.warningActive) {
    startCountdown(ROUTE_ACK_COUNTDOWN_SEC, 'ROUTE_DEVIATION');
  }
}

async function resolveBatteryLevel() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return Number.isFinite(level) ? level : null;
  } catch {
    return null;
  }
}

async function handleLocationUpdate(rawLocation) {
  const filtered = gpsFilter.update(
    rawLocation.coords.latitude,
    rawLocation.coords.longitude,
    rawLocation.coords.accuracy ?? null,
    rawLocation.timestamp
  );

  if (!filtered) return;

  const batteryLevel = await resolveBatteryLevel();

  const location = {
    latitude: filtered.latitude,
    longitude: filtered.longitude,
    speed: rawLocation.coords.speed ?? 0,
    heading: rawLocation.coords.heading ?? null,
    accuracy: rawLocation.coords.accuracy ?? null,
    batteryLevel,
    timestamp: rawLocation.timestamp,
  };

  monitorState.lastLocation = location;
  getStore?.()?.setCurrentLocation?.(location);

  if (monitorState.sessionId) {
    emitLocationUpdate(monitorState.sessionId, location, monitorState.warningActive ? 'WARNING' : 'MONITORING');
  }

  if (monitorState.mode === 'GEOFENCE') {
    processGeofence(location);
  } else if (monitorState.mode === 'TRANSIT') {
    processTransit(location);
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('[LocationTask] Error:', error.message);
    return;
  }

  if (data?.locations?.length) {
    const latest = data.locations[data.locations.length - 1];
    handleLocationUpdate(latest);
  }
});

async function persistActiveSession(config) {
  await AsyncStorage.setItem(
    ACTIVE_SESSION_KEY,
    JSON.stringify({
      ...config,
      savedAt: Date.now(),
    })
  );
}

async function clearPersistedSession() {
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
}

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Foreground location permission denied');
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error('Background location permission denied — required for Safe Zone monitoring');
  }

  return true;
}

export async function startBackgroundTracking(config) {
  const { sessionId, mode, geofence, routes } = config;

  monitorState.sessionId = sessionId;
  monitorState.mode = mode;
  monitorState.geofence = geofence || null;
  monitorState.routes = routes?.map((r) => r.polyline || r) || [];
  monitorState.routeOffSince = null;
  gpsFilter.reset();
  clearCountdown();

  await persistActiveSession(config);

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: LOCATION_UPDATE_INTERVAL_MS,
    distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SOS-Vidha Active Safeguard',
      notificationBody: 'Monitoring location in real-time',
      notificationColor: '#EF4444',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    deferredUpdatesInterval: LOCATION_UPDATE_INTERVAL_MS,
    deferredUpdatesDistance: LOCATION_DISTANCE_INTERVAL_M,
  });
}

export async function stopBackgroundTracking() {
  clearCountdown();
  monitorState.sessionId = null;
  monitorState.mode = null;
  monitorState.geofence = null;
  monitorState.routes = [];
  gpsFilter.reset();

  await clearPersistedSession();

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export async function restoreMonitoringAfterReboot() {
  const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return false;

  const config = JSON.parse(raw);
  if (!config?.sessionId) return false;

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;

  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (registered) return true;

  try {
    await startBackgroundTracking(config);
    return true;
  } catch (err) {
    console.warn('[Location] Reboot restore failed:', err.message);
    return false;
  }
}

export function disarmLocalWarning() {
  clearCountdown();
}

export async function getCurrentPosition() {
  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });
}

export { handleLocationUpdate, monitorState };
