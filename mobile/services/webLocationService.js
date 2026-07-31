import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { emitLocationUpdate } from './socketService';

let watchId = null;
let intervalId = null;
let tick = 0;
let base = { latitude: 28.6139, longitude: 77.209 };
let listeners = new Set();
let streamSessionId = null;
let lastLocation = null;

function notify(location) {
  lastLocation = location;
  listeners.forEach((cb) => cb(location));
  if (streamSessionId) {
    emitLocationUpdate(streamSessionId, location, 'MONITORING');
  }
}

function simulateStep() {
  tick += 1;
  const t = tick * 0.05;
  return {
    latitude: base.latitude + Math.sin(t) * 0.0008,
    longitude: base.longitude + Math.cos(t) * 0.0008,
    altitude: 216 + Math.sin(t) * 3,
    accuracy: 8 + (tick % 5),
    speed: 1.2 + (tick % 3) * 0.3,
    heading: (tick * 7) % 360,
    batteryLevel: 0.72,
    signalQuality: tick % 4 === 0 ? 'Good' : 'Excellent',
    timestamp: Date.now(),
  };
}

export function getLastKnownLocation() {
  return lastLocation;
}

export function setStreamSessionId(sessionId) {
  streamSessionId = sessionId;
}

export async function requestLocationPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  return fg.status === 'granted';
}

export async function getCurrentPosition() {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  base = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  tick = 0;

  let batteryLevel = 0.78;
  try {
    batteryLevel = await Battery.getBatteryLevelAsync();
  } catch {
    /* noop */
  }

  const loc = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    altitude: pos.coords.altitude ?? 216,
    accuracy: pos.coords.accuracy ?? 12,
    speed: pos.coords.speed ?? 0,
    heading: pos.coords.heading ?? 0,
    batteryLevel,
    signalQuality: 'Good',
    timestamp: pos.timestamp,
  };
  notify(loc);
  return loc;
}

export function subscribeLocation(callback) {
  listeners.add(callback);
  if (lastLocation) callback(lastLocation);
  return () => listeners.delete(callback);
}

export async function startLiveTracking(sessionId = null) {
  if (sessionId) streamSessionId = sessionId;
  if (intervalId) return;

  try {
    await getCurrentPosition();
  } catch {
    notify(simulateStep());
  }

  intervalId = setInterval(async () => {
    let loc = simulateStep();
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      base = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      let batteryLevel = 0.78;
      try {
        batteryLevel = await Battery.getBatteryLevelAsync();
      } catch {
        /* noop */
      }
      loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: pos.coords.altitude ?? loc.altitude,
        accuracy: pos.coords.accuracy ?? loc.accuracy,
        speed: pos.coords.speed ?? loc.speed,
        heading: pos.coords.heading ?? loc.heading,
        batteryLevel,
        signalQuality: loc.signalQuality,
        timestamp: Date.now(),
      };
    } catch {
      /* simulated */
    }
    notify(loc);
  }, 2000);
}

export function stopLiveTracking() {
  streamSessionId = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export function getElapsedLabel(startedAt) {
  if (!startedAt) return '00:00';
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
