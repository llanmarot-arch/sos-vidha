const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

const ActivityType = {
  Other: 1,
  AutomotiveNavigation: 2,
  Fitness: 3,
  OtherNavigation: 4,
  Airborne: 5,
};

let watchId = null;

const GEO_ERROR_CODES = { 1: 'PERMISSION_DENIED', 2: 'POSITION_UNAVAILABLE', 3: 'TIMEOUT' };

function locationError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function toLocationObject(coords, timestamp) {
  return {
    coords: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? null,
      accuracy: coords.accuracy ?? null,
      altitudeAccuracy: coords.altitudeAccuracy ?? null,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
    },
    timestamp,
  };
}

function getWebPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(locationError('UNSUPPORTED', 'This browser cannot provide a GPS location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toLocationObject(pos.coords, pos.timestamp)),
      (err) =>
        reject(locationError(GEO_ERROR_CODES[err?.code] || 'POSITION_UNAVAILABLE', err?.message || 'Location unavailable')),
      { enableHighAccuracy: true, timeout: options.timeout ?? 8000, maximumAge: 0 }
    );
  });
}

export async function requestForegroundPermissionsAsync() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { status: 'denied', granted: false, canAskAgain: false };
  }
  try {
    const result = await navigator.permissions?.query({ name: 'geolocation' });
    if (result?.state === 'denied') {
      return { status: 'denied', granted: false, canAskAgain: false };
    }
  } catch {
    /* Permissions API unavailable; the browser prompts on first use. */
  }
  return { status: 'granted', granted: true, canAskAgain: true };
}

export async function requestBackgroundPermissionsAsync() {
  return { status: 'granted', granted: true, canAskAgain: true };
}

export async function getBackgroundPermissionsAsync() {
  return { status: 'granted', granted: true };
}

export async function getCurrentPositionAsync(options) {
  return getWebPosition(options);
}

export async function startLocationUpdatesAsync(taskName, options) {
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      () => {},
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }
  return true;
}

export async function stopLocationUpdatesAsync() {
  if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export { Accuracy, ActivityType };
