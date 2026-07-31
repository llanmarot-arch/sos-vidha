const EARTH_RADIUS_M = 6371000;

export const HIGH_SPEED_THRESHOLD_KMH = 35;
export const GPS_MAX_ACCURACY_M = 35;
export const GPS_TELEPORT_SPEED_KMH = 180;

export function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

export function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function bearingDegrees(lat1, lon1, lat2, lon2) {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function pointToSegmentDistanceM(px, py, ax, ay, bx, by) {
  const latScale = toRadians(1) * EARTH_RADIUS_M;
  const lonScale = latScale * Math.cos(toRadians((ay + by + py) / 3));

  const pxM = px * lonScale;
  const pyM = py * latScale;
  const axM = ax * lonScale;
  const ayM = ay * latScale;
  const bxM = bx * lonScale;
  const byM = by * latScale;

  const abx = bxM - axM;
  const aby = byM - ayM;
  const apx = pxM - axM;
  const apy = pyM - ayM;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return Math.hypot(pxM - axM, pyM - ayM);
  }

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = axM + t * abx;
  const closestY = ayM + t * aby;
  return Math.hypot(pxM - closestX, pyM - closestY);
}

export function pointToPolylineDistanceM(point, polyline) {
  if (!polyline || polyline.length < 2) {
    return Infinity;
  }

  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dist = pointToSegmentDistanceM(
      point.longitude,
      point.latitude,
      a.longitude,
      a.latitude,
      b.longitude,
      b.latitude
    );
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

export function pointToRoutesDistanceM(point, routes) {
  if (!routes?.length) return Infinity;
  return Math.min(...routes.map((route) => pointToPolylineDistanceM(point, route)));
}

export function msToKmh(speedMs) {
  if (speedMs == null || Number.isNaN(speedMs)) return 0;
  return speedMs * 3.6;
}

export function isMovingAwayFromCenter(lat, lon, speedMs, headingDeg, centerLat, centerLon) {
  const speedKmh = msToKmh(speedMs);
  if (speedKmh <= HIGH_SPEED_THRESHOLD_KMH) return false;
  if (headingDeg == null || Number.isNaN(headingDeg)) return speedKmh > HIGH_SPEED_THRESHOLD_KMH;

  const bearingToCenter = bearingDegrees(lat, lon, centerLat, centerLon);
  const bearingAway = (bearingToCenter + 180) % 360;
  const diff = Math.abs(((headingDeg - bearingAway + 540) % 360) - 180);
  return diff <= 45;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 1D Kalman filter for scalar GPS coordinate smoothing.
 */
class KalmanFilter1D {
  constructor(processNoise = 1e-7, measurementNoise = 1e-5) {
    this.q = processNoise;
    this.r = measurementNoise;
    this.x = null;
    this.p = 1;
  }

  filter(measurement) {
    if (this.x == null) {
      this.x = measurement;
      return this.x;
    }

    this.p += this.q;
    const k = this.p / (this.p + this.r);
    this.x += k * (measurement - this.x);
    this.p *= 1 - k;
    return this.x;
  }

  reset() {
    this.x = null;
    this.p = 1;
  }
}

/**
 * GPS noise filter: moving median buffer + Kalman smoothing,
 * accuracy gate, and teleport speed rejection.
 */
export class GPSFilter {
  constructor(options = {}) {
    this.maxAccuracyM = options.maxAccuracyM ?? GPS_MAX_ACCURACY_M;
    this.maxSpeedKmh = options.maxSpeedKmh ?? GPS_TELEPORT_SPEED_KMH;
    this.bufferSize = options.bufferSize ?? 5;
    this.latKalman = new KalmanFilter1D(1e-7, 1e-5);
    this.lngKalman = new KalmanFilter1D(1e-7, 1e-5);
    this.buffer = [];
    this.lastAccepted = null;
    this.lastTimestamp = null;
  }

  reset() {
    this.buffer = [];
    this.lastAccepted = null;
    this.lastTimestamp = null;
    this.latKalman.reset();
    this.lngKalman.reset();
  }

  update(lat, lng, accuracy = null, timestamp = Date.now()) {
    if (accuracy != null && accuracy > this.maxAccuracyM) {
      return this.lastAccepted;
    }

    if (this.lastAccepted && this.lastTimestamp) {
      const dtSec = (timestamp - this.lastTimestamp) / 1000;
      if (dtSec > 0) {
        const jumpM = haversineDistanceM(
          lat,
          lng,
          this.lastAccepted.latitude,
          this.lastAccepted.longitude
        );
        const speedKmh = (jumpM / dtSec) * 3.6;
        if (speedKmh > this.maxSpeedKmh) {
          return this.lastAccepted;
        }
      }
    }

    this.buffer.push({ lat, lng });
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    const medLat = median(this.buffer.map((p) => p.lat));
    const medLng = median(this.buffer.map((p) => p.lng));

    const filteredLat = this.latKalman.filter(medLat);
    const filteredLng = this.lngKalman.filter(medLng);

    this.lastAccepted = { latitude: filteredLat, longitude: filteredLng };
    this.lastTimestamp = timestamp;
    return this.lastAccepted;
  }
}

export function decodePolyline(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

export function decodeMapboxPolyline6(encoded) {
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = 1e6;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      latitude: lat / factor,
      longitude: lng / factor,
    });
  }

  return coordinates;
}
