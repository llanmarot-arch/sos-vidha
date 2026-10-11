import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { emitLocationUpdate } from './socketService';
import { classifyLocationError } from './apiClientPolicy';

const POLL_INTERVAL_MS = 2000;

let intervalId = null;
let listeners = new Set();
let errorListeners = new Set();
let streamSessionId = null;
let lastLocation = null;
let lastError = null;

function notify(location) {
  lastLocation = location;
  lastError = null;
  listeners.forEach((cb) => cb(location));
  if (streamSessionId) {
    emitLocationUpdate(streamSessionId, location, 'MONITORING');
  }
}

function notifyError(code) {
  lastError = code;
  errorListeners.forEach((cb) => cb(code));
}

async function readBatteryLevel() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return Number.isFinite(level) && level >= 0 ? level : null;
  } catch {
    return null;
  }
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error('Timed out waiting for a GPS fix');
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Builds a location from a real device fix. Fields the device did not report stay null. */
function toLocation(pos, batteryLevel) {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    altitude: pos.coords.altitude ?? null,
    accuracy: pos.coords.accuracy ?? null,
    speed: pos.coords.speed ?? null,
    heading: pos.coords.heading ?? null,
    batteryLevel,
    timestamp: pos.timestamp,
  };
}

export function getLastKnownLocation() {
  return lastLocation;
}

export function getLastLocationError() {
  return lastError;
}

export function setStreamSessionId(sessionId) {
  streamSessionId = sessionId;
}

export async function requestLocationPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  return fg.status === 'granted';
}

/**
 * Resolves with a real GPS fix or rejects with an error whose `code` is one of
 * PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT or UNSUPPORTED.
 */
export async function getCurrentPosition({ timeoutMs = 8000, accuracy = Location.Accuracy.High } = {}) {
  try {
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy, timeout: timeoutMs }),
      timeoutMs + 500
    );
    const loc = toLocation(pos, await readBatteryLevel());
    notify(loc);
    return loc;
  } catch (err) {
    const code = classifyLocationError(err);
    notifyError(code);
    const wrapped = new Error(err?.message || 'Location unavailable');
    wrapped.code = code;
    throw wrapped;
  }
}

export function subscribeLocation(callback) {
  listeners.add(callback);
  if (lastLocation) callback(lastLocation);
  return () => listeners.delete(callback);
}

export function subscribeLocationError(callback) {
  errorListeners.add(callback);
  if (lastError) callback(lastError);
  return () => errorListeners.delete(callback);
}

export async function startLiveTracking(sessionId = null) {
  if (sessionId) streamSessionId = sessionId;
  if (intervalId) return;

  await getCurrentPosition().catch(() => {});

  let inFlight = false;
  intervalId = setInterval(() => {
    if (inFlight) return;
    inFlight = true;
    getCurrentPosition({ accuracy: Location.Accuracy.Balanced })
      .catch(() => {})
      .finally(() => {
        inFlight = false;
      });
  }, POLL_INTERVAL_MS);
}

export function stopLiveTracking() {
  streamSessionId = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function getElapsedLabel(startedAt) {
  if (!startedAt) return '00:00';
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
