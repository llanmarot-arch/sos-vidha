const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;
const EARTH_RADIUS_M = 6371008.8;

const DEVICE_LOCATION_ERRORS = ['PERMISSION_DENIED', 'POSITION_UNAVAILABLE', 'TIMEOUT', 'UNSUPPORTED'];

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function optionalNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/**
 * Accepts a device location only if coordinates and the device's own fix timestamp are valid.
 * Never fills in missing values.
 */
function validateLocationInput(raw, nowMs) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'NOT_PROVIDED' };
  }
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return { ok: false, reason: 'INVALID_COORDINATES' };
  }

  const timestamp = Number(raw.timestamp);
  if (!isFiniteNumber(timestamp) || timestamp <= 0) {
    return { ok: false, reason: 'MISSING_TIMESTAMP' };
  }
  if (timestamp > nowMs + MAX_FUTURE_SKEW_MS) {
    return { ok: false, reason: 'FUTURE_TIMESTAMP' };
  }

  return {
    ok: true,
    location: {
      latitude,
      longitude,
      timestamp,
      accuracy: optionalNumber(raw.accuracy, { min: 0 }),
      speed: optionalNumber(raw.speed, { min: 0 }),
      heading: optionalNumber(raw.heading, { min: 0, max: 360 }),
      batteryLevel: optionalNumber(raw.batteryLevel, { min: 0, max: 1 }),
    },
  };
}

function normalizeDeviceLocationError(code) {
  return DEVICE_LOCATION_ERRORS.includes(code) ? code : null;
}

/**
 * Classifies a location relative to a reference time (normally the server-recorded SOS time).
 * Status is one of FRESH, STALE, LOW_ACCURACY, UNAVAILABLE.
 */
function assessLocation(location, { referenceTimeMs, staleAfterMs, maxAccuracyM, unavailableReason = null }) {
  if (!location) {
    return { status: 'UNAVAILABLE', reason: unavailableReason || 'NOT_PROVIDED', location: null, ageMs: null };
  }
  const ageMs = Math.max(0, referenceTimeMs - location.timestamp);
  if (ageMs > staleAfterMs) {
    return { status: 'STALE', reason: null, location, ageMs };
  }
  if (location.accuracy != null && location.accuracy > maxAccuracyM) {
    return { status: 'LOW_ACCURACY', reason: null, location, ageMs };
  }
  return { status: 'FRESH', reason: null, location, ageMs };
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Returns a safety zone only when every persisted field is present and valid. */
function normalizeSafetyZone(raw) {
  if (!raw) return null;
  const latitude = optionalNumber(raw.latitude, { min: -90, max: 90 });
  const longitude = optionalNumber(raw.longitude, { min: -180, max: 180 });
  const radiusM = optionalNumber(raw.radiusM, { min: 1 });
  if (latitude == null || longitude == null || radiusM == null) return null;
  return { latitude, longitude, radiusM };
}

/** Distance is only calculated from a fresh, accurate fix. */
function assessSafetyZone(zone, assessment) {
  if (!zone) {
    return { configured: false, radiusM: null, distanceM: null, outside: null, reason: 'NOT_CONFIGURED' };
  }
  if (assessment.status !== 'FRESH') {
    return {
      configured: true,
      radiusM: zone.radiusM,
      distanceM: null,
      outside: null,
      reason: `LOCATION_${assessment.status}`,
    };
  }
  const distanceM = haversineMeters(zone, assessment.location);
  return { configured: true, radiusM: zone.radiusM, distanceM, outside: distanceM > zone.radiusM, reason: null };
}

module.exports = {
  DEVICE_LOCATION_ERRORS,
  validateLocationInput,
  normalizeDeviceLocationError,
  assessLocation,
  haversineMeters,
  normalizeSafetyZone,
  assessSafetyZone,
};
