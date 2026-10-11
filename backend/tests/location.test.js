const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateLocationInput,
  normalizeDeviceLocationError,
  assessLocation,
  haversineMeters,
  normalizeSafetyZone,
  assessSafetyZone,
} = require('../lib/location');

const NOW = Date.UTC(2026, 9, 11, 6, 0, 0);
const OPTS = { referenceTimeMs: NOW, staleAfterMs: 120000, maxAccuracyM: 500 };

describe('validateLocationInput', () => {
  it('rejects a missing location', () => {
    assert.deepEqual(validateLocationInput(null, NOW), { ok: false, reason: 'NOT_PROVIDED' });
  });

  it('rejects out-of-range and null-island coordinates', () => {
    assert.equal(validateLocationInput({ latitude: 91, longitude: 0, timestamp: NOW }, NOW).reason, 'INVALID_COORDINATES');
    assert.equal(validateLocationInput({ latitude: 0, longitude: 0, timestamp: NOW }, NOW).reason, 'INVALID_COORDINATES');
    assert.equal(validateLocationInput({ latitude: 'x', longitude: 77, timestamp: NOW }, NOW).reason, 'INVALID_COORDINATES');
  });

  it('requires the device fix timestamp and never substitutes the server time', () => {
    assert.equal(validateLocationInput({ latitude: 28.6, longitude: 77.2 }, NOW).reason, 'MISSING_TIMESTAMP');
    assert.equal(
      validateLocationInput({ latitude: 28.6, longitude: 77.2, timestamp: NOW + 10 * 60 * 1000 }, NOW).reason,
      'FUTURE_TIMESTAMP'
    );
  });

  it('keeps unreported optional fields as null', () => {
    const result = validateLocationInput({ latitude: 28.6, longitude: 77.2, timestamp: NOW - 1000 }, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.location.accuracy, null);
    assert.equal(result.location.speed, null);
    assert.equal(result.location.batteryLevel, null);
    assert.equal(result.location.timestamp, NOW - 1000);
  });

  it('only accepts known device error codes', () => {
    assert.equal(normalizeDeviceLocationError('PERMISSION_DENIED'), 'PERMISSION_DENIED');
    assert.equal(normalizeDeviceLocationError('<script>'), null);
  });
});

describe('assessLocation', () => {
  it('reports missing GPS as UNAVAILABLE with the device reason', () => {
    const a = assessLocation(null, { ...OPTS, unavailableReason: 'PERMISSION_DENIED' });
    assert.equal(a.status, 'UNAVAILABLE');
    assert.equal(a.reason, 'PERMISSION_DENIED');
    assert.equal(a.location, null);
  });

  it('reports an old fix as STALE relative to the SOS time', () => {
    const a = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: NOW - 10 * 60 * 1000, accuracy: 10 }, OPTS);
    assert.equal(a.status, 'STALE');
    assert.equal(a.ageMs, 10 * 60 * 1000);
  });

  it('reports an imprecise fix as LOW_ACCURACY', () => {
    const a = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: NOW, accuracy: 2000 }, OPTS);
    assert.equal(a.status, 'LOW_ACCURACY');
  });

  it('reports a recent accurate fix as FRESH', () => {
    const a = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: NOW - 5000, accuracy: 12 }, OPTS);
    assert.equal(a.status, 'FRESH');
  });
});

describe('distance and safety zone', () => {
  it('computes great-circle distance accurately', () => {
    // One degree of latitude is ~111.2 km on the mean-radius sphere.
    const d = haversineMeters({ latitude: 0, longitude: 77 }, { latitude: 1, longitude: 77 });
    assert.ok(Math.abs(d - 111195) < 50, `got ${d}`);
    // New Delhi (India Gate) to Connaught Place is roughly 2.4 km.
    const cp = haversineMeters({ latitude: 28.6129, longitude: 77.2295 }, { latitude: 28.6315, longitude: 77.2167 });
    assert.ok(cp > 2300 && cp < 2500, `got ${cp}`);
  });

  it('reports no zone when none is configured', () => {
    const fresh = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: NOW, accuracy: 5 }, OPTS);
    const zone = assessSafetyZone(null, fresh);
    assert.equal(zone.configured, false);
    assert.equal(zone.radiusM, null);
    assert.equal(zone.distanceM, null);
  });

  it('rejects partially configured zones', () => {
    assert.equal(normalizeSafetyZone({ latitude: 28.6, longitude: 77.2 }), null);
    assert.equal(normalizeSafetyZone({ latitude: 28.6, radiusM: 500 }), null);
    assert.deepEqual(normalizeSafetyZone({ latitude: 28.6, longitude: 77.2, radiusM: 500 }), {
      latitude: 28.6,
      longitude: 77.2,
      radiusM: 500,
    });
  });

  it('reports the configured radius and the distance from a fresh fix', () => {
    const zoneCfg = { latitude: 0, longitude: 77, radiusM: 1000 };
    const fresh = assessLocation({ latitude: 0.01, longitude: 77, timestamp: NOW, accuracy: 5 }, OPTS);
    const zone = assessSafetyZone(zoneCfg, fresh);
    assert.equal(zone.radiusM, 1000);
    assert.ok(Math.abs(zone.distanceM - 1112) < 5, `got ${zone.distanceM}`);
    assert.equal(zone.outside, true);
  });

  it('does not calculate distance from stale or missing GPS', () => {
    const zoneCfg = { latitude: 0, longitude: 77, radiusM: 1000 };
    const stale = assessLocation({ latitude: 0.01, longitude: 77, timestamp: NOW - 3600000 }, OPTS);
    assert.equal(assessSafetyZone(zoneCfg, stale).distanceM, null);
    assert.equal(assessSafetyZone(zoneCfg, stale).reason, 'LOCATION_STALE');
    const missing = assessLocation(null, OPTS);
    assert.equal(assessSafetyZone(zoneCfg, missing).distanceM, null);
  });
});
