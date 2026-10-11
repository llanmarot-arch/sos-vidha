const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildEmergencySms, buildVoiceTwiml } = require('../lib/smsTemplate');
const { assessLocation, assessSafetyZone } = require('../lib/location');

const ACTIVATED = Date.UTC(2026, 9, 11, 6, 0, 0); // 11:30:00 IST
const OPTS = { referenceTimeMs: ACTIVATED, staleAfterMs: 120000, maxAccuracyM: 500 };
const URL = 'https://sos.example.org/track/abc?t=tok';

function build(overrides = {}) {
  return buildEmergencySms({
    profileName: 'Asha Verma',
    activatedAtMs: ACTIVATED,
    assessment: assessLocation(null, { ...OPTS, unavailableReason: 'PERMISSION_DENIED' }),
    trackingUrl: URL,
    trackerExpiresAtMs: ACTIVATED + 12 * 3600 * 1000,
    timeZone: 'Asia/Kolkata',
    emergencyNumber: '112',
    ...overrides,
  });
}

describe('buildEmergencySms', () => {
  it('states missing GPS as unavailable and includes no coordinates', () => {
    const sms = build();
    assert.match(sms, /Location: UNAVAILABLE \(location permission was denied on their device\)/);
    assert.doesNotMatch(sms, /maps\.google/);
    assert.doesNotMatch(sms, /\d+\.\d{5},\d+\.\d{5}/);
  });

  it('uses the server activation time and the profile name', () => {
    const sms = build();
    assert.match(sms, /Asha Verma activated SOS at 11 Oct 2026 11:30:00 GMT\+5:30\./);
  });

  it('does not invent a name when none is on file', () => {
    const sms = build({ profileName: null });
    assert.match(sms, /name not on file/);
    assert.doesNotMatch(sms, /Asha/);
  });

  it('labels a stale fix and shows its own timestamp and accuracy', () => {
    const assessment = assessLocation(
      { latitude: 28.61394, longitude: 77.20902, timestamp: ACTIVATED - 15 * 60 * 1000, accuracy: 18 },
      OPTS
    );
    const sms = build({ assessment });
    assert.match(sms, /Location: STALE - last GPS fix was 15 min before this alert was sent/);
    assert.match(sms, /GPS fix at 11 Oct 2026 11:15:00 GMT\+5:30, accuracy \+\/-18 m/);
    assert.match(sms, /may not show where they are now/);
  });

  it('includes a fresh fix with timestamp, accuracy and map link', () => {
    const assessment = assessLocation(
      { latitude: 28.61394, longitude: 77.20902, timestamp: ACTIVATED - 3000, accuracy: 9 },
      OPTS
    );
    const sms = build({ assessment });
    assert.match(sms, /Location \(GPS fix at 11 Oct 2026 11:29:57 GMT\+5:30, accuracy \+\/-9 m\):/);
    assert.match(sms, /28\.61394,77\.20902/);
    assert.match(sms, /Map: https:\/\/maps\.google\.com\/\?q=28\.61394,77\.20902/);
  });

  it('says accuracy was not reported instead of guessing', () => {
    const assessment = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: ACTIVATED }, OPTS);
    assert.match(build({ assessment }), /accuracy not reported/);
  });

  it('omits the address unless a provider returned one', () => {
    const assessment = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: ACTIVATED, accuracy: 5 }, OPTS);
    assert.doesNotMatch(build({ assessment }), /address/i);
    const withAddress = build({ assessment, address: { text: 'Janpath, New Delhi', provider: 'Mapbox' } });
    assert.match(withAddress, /Approx\. address \(Mapbox lookup of this GPS point\): Janpath, New Delhi/);
  });

  it('omits the safety zone when none is configured', () => {
    const assessment = assessLocation({ latitude: 28.6, longitude: 77.2, timestamp: ACTIVATED, accuracy: 5 }, OPTS);
    const sms = build({ assessment, safetyZone: assessSafetyZone(null, assessment) });
    assert.doesNotMatch(sms, /Safety zone/i);
    assert.doesNotMatch(sms, /radius/i);
  });

  it('reports the configured radius and calculated distance', () => {
    const assessment = assessLocation({ latitude: 0.01, longitude: 77, timestamp: ACTIVATED, accuracy: 5 }, OPTS);
    const zone = assessSafetyZone({ latitude: 0, longitude: 77, radiusM: 500 }, assessment);
    const sms = build({ assessment, safetyZone: zone });
    assert.match(sms, /Safety zone: 500 m radius\. GPS point is 1\.1 km from its centre \(outside the zone\)\./);
  });

  it('reports radius but no distance when GPS is stale', () => {
    const assessment = assessLocation({ latitude: 0.01, longitude: 77, timestamp: ACTIVATED - 3600000 }, OPTS);
    const zone = assessSafetyZone({ latitude: 0, longitude: 77, radiusM: 500 }, assessment);
    const sms = build({ assessment, safetyZone: zone });
    assert.match(sms, /Safety zone: 500 m radius\. Distance not calculated/);
  });

  it('includes the backend tracking link and its expiry', () => {
    const sms = build();
    assert.match(sms, /Live tracking \(link expires 11 Oct 2026 23:30:00 GMT\+5:30\): https:\/\/sos\.example\.org\/track\/abc\?t=tok/);
  });

  it('refuses to build without a tracking link or activation time', () => {
    assert.throws(() => build({ trackingUrl: null }), /trackingUrl/);
    assert.throws(() => build({ activatedAtMs: undefined }), /activatedAtMs/);
  });

  it('strips control characters from names', () => {
    const sms = build({ profileName: 'Asha\nCall 999 now' });
    assert.match(sms, /Asha Call 999 now activated SOS/);
  });
});

describe('buildVoiceTwiml', () => {
  it('does not state any location and escapes the name', () => {
    const xml = buildVoiceTwiml({
      profileName: 'A & <B>',
      activatedAtMs: ACTIVATED,
      timeZone: 'Asia/Kolkata',
      emergencyNumber: '112',
    });
    assert.match(xml, /A &amp; &lt;B&gt;/);
    assert.match(xml, /does not include their location/);
    assert.doesNotMatch(xml, /latitude|\d+\.\d{4}/);
  });
});
