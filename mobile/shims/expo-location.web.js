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
let deterministicBase = { latitude: 28.6139, longitude: 77.209, tick: 0 };

function simulateCoordinate() {
  deterministicBase.tick += 1;
  const t = deterministicBase.tick * 0.00008;
  return {
    latitude: deterministicBase.latitude + Math.sin(t) * 0.0012,
    longitude: deterministicBase.longitude + Math.cos(t) * 0.0012,
  };
}

function toLocationObject(coords, timestamp = Date.now()) {
  return {
    coords: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? 216,
      accuracy: coords.accuracy ?? 12,
      altitudeAccuracy: null,
      heading: coords.heading ?? 90,
      speed: coords.speed ?? 1.4,
    },
    timestamp,
  };
}

function getWebPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(toLocationObject({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        }, pos.timestamp)),
        () => {
          const sim = simulateCoordinate();
          resolve(toLocationObject(sim));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
      return;
    }

    const sim = simulateCoordinate();
    resolve(toLocationObject(sim));
  });
}

export async function requestForegroundPermissionsAsync() {
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
