const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');
const { createSosServer } = require('../lib/app');
const { loadConfig } = require('../lib/config');
const { MemoryIncidentRepository } = require('../lib/incidentRepository');

const START = Date.UTC(2026, 9, 11, 6, 0, 0);
const quiet = { info() {}, warn() {}, error() {} };
const USERS = { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } };
const CONTACTS = {
  'user-a': [
    { id: 'ca1', name: 'Ravi', phone_e164: '+919800000001' },
    { id: 'ca2', name: 'Meera', phone_e164: '+919800000002' },
  ],
  'user-b': [{ id: 'cb1', name: 'Other', phone_e164: '+919800000099' }],
};
const PROFILES = {
  'user-a': { fullName: 'Asha Verma', safeZone: { latitude: 28.6, longitude: 77.2, radiusM: 500 } },
  'user-b': { fullName: null, safeZone: null },
};
const PIN = { standardPinHash: 'a'.repeat(64), duressPinHash: 'b'.repeat(64), pinSalt: 'salt' };

function fakeProvider(failWith = null) {
  const calls = [];
  return {
    calls,
    async send(message) {
      calls.push(message);
      if (failWith) throw failWith;
      return { sid: `SM${calls.length}`, status: 'queued' };
    },
    async findRecentMessage() {
      return { supported: true, match: null };
    },
    validateWebhook: ({ signature }) => signature === 'valid-signature',
  };
}

let active = [];

async function harness({ env = {}, provider = fakeProvider(), contacts = CONTACTS } = {}) {
  const clock = { t: START };
  const config = loadConfig({
    NODE_ENV: 'test',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    PUBLIC_SERVER_URL: 'https://sos.example.org',
    TWILIO_ACCOUNT_SID: 'AC_test',
    TWILIO_AUTH_TOKEN: 'test',
    TWILIO_PHONE_NUMBER: '+15550000000',
    TWILIO_WHATSAPP_NUMBER: '+15550000001',
    SMS_LIVE_SEND: 'true',
    TWILIO_VOICE_ENABLED: 'false',
    SMS_RETRY_BASE_MS: '1',
    ...env,
  });
  const incidents = new MemoryIncidentRepository({ now: () => clock.t });
  const accounts = {
    verifyAccessToken: async (token) => USERS[token] || null,
    getEmergencyContacts: async (userId) => contacts[userId] || [],
    getAlertProfile: async (userId) => PROFILES[userId] || { fullName: null, safeZone: null },
  };
  const sos = createSosServer({
    config,
    accounts,
    incidents,
    provider,
    publicServerUrl: config.explicitPublicUrl,
    now: () => clock.t,
    sleep: async () => {},
    logger: quiet,
  });
  const { port } = await sos.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  const h = { sos, incidents, provider, clock, base, port, sockets: [] };
  active.push(h);
  return h;
}

afterEach(async () => {
  for (const h of active) {
    h.sockets.forEach((s) => s.disconnect());
    await h.sos.waitForIdle();
    await h.sos.stop();
  }
  active = [];
});

async function api(h, method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${h.base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text, headers: res.headers };
}

function startBody(h, overrides = {}) {
  return {
    mode: 'GEOFENCE',
    emergency: true,
    clientRequestId: `req-${Math.random().toString(16).slice(2, 12)}`,
    location: { latitude: 28.61, longitude: 77.2, accuracy: 12, timestamp: h.clock.t - 3000 },
    ...PIN,
    ...overrides,
  };
}

async function startSos(h, token = 'token-a', overrides = {}) {
  const res = await api(h, 'POST', '/api/session/start', { token, body: startBody(h, overrides) });
  await h.sos.waitForIdle();
  return res;
}

function trackerToken(trackingUrl) {
  return new URL(trackingUrl).searchParams.get('t');
}

function connect(h, auth = {}) {
  return new Promise((resolve, reject) => {
    const s = ioClient(h.base, { transports: ['websocket'], auth, reconnection: false, forceNew: true });
    h.sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function once(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('SOS start and recipient selection', () => {
  it('rejects unauthenticated and invalid-token requests without sending anything', async () => {
    const h = await harness();
    const anon = await api(h, 'POST', '/api/session/start', { body: startBody(h) });
    assert.equal(anon.status, 401);
    const bad = await api(h, 'POST', '/api/session/start', { token: 'forged', body: startBody(h) });
    assert.equal(bad.status, 401);
    assert.equal(h.provider.calls.length, 0);
  });

  it("alerts only the authenticated user's stored contacts, ignoring client-supplied numbers", async () => {
    const h = await harness();
    const res = await startSos(h, 'token-a', { contact1: '+15551234567', contact2: '+15557654321' });
    assert.equal(res.status, 201);
    const sent = h.provider.calls.map((c) => c.to).sort();
    assert.deepEqual(sent, ['+919800000001', '+919800000002']);
    assert.ok(h.provider.calls.every((c) => c.channel === 'sms'));
    assert.equal(res.json.alerts.mode, 'live');
    assert.equal(res.json.alerts.recipientCount, 2);
  });

  it('builds the SMS from verified data: name, server time, GPS fix, zone radius and distance, tracking link', async () => {
    const h = await harness();
    const res = await startSos(h);
    const body = h.provider.calls[0].body;
    assert.match(body, /Asha Verma activated SOS at 11 Oct 2026 11:30:00 GMT\+5:30/);
    assert.match(body, /GPS fix at 11 Oct 2026 11:29:57 GMT\+5:30, accuracy \+\/-12 m/);
    assert.match(body, /28\.61000,77\.20000/);
    assert.match(body, /Safety zone: 500 m radius\. GPS point is 1\.1 km from its centre \(outside the zone\)/);
    assert.ok(body.includes(res.json.trackingUrl));
    assert.ok(res.json.trackingUrl.startsWith('https://sos.example.org/track/'));
  });

  it('states location unavailable when the device reports no GPS', async () => {
    const h = await harness();
    const res = await startSos(h, 'token-a', { location: null, locationError: 'PERMISSION_DENIED' });
    assert.equal(res.status, 201);
    assert.equal(res.json.location.status, 'UNAVAILABLE');
    const body = h.provider.calls[0].body;
    assert.match(body, /Location: UNAVAILABLE \(location permission was denied on their device\)/);
    assert.match(body, /Safety zone: 500 m radius\. Distance not calculated/);
    assert.doesNotMatch(body, /maps\.google/);
  });

  it('labels stale GPS as stale', async () => {
    const h = await harness();
    const stale = { latitude: 28.61, longitude: 77.2, accuracy: 8, timestamp: START - 20 * 60 * 1000 };
    const res = await startSos(h, 'token-a', { location: stale });
    assert.equal(res.json.location.status, 'STALE');
    assert.match(h.provider.calls[0].body, /Location: STALE - last GPS fix was 20 min before this alert was sent/);
  });

  it('omits the safety zone when the user has none configured', async () => {
    const h = await harness();
    await startSos(h, 'token-b');
    const body = h.provider.calls[0].body;
    assert.doesNotMatch(body, /Safety zone/);
    assert.match(body, /name not on file/);
  });

  it('refuses to start without stored contacts and tells the user to call 112', async () => {
    const h = await harness({ contacts: { 'user-a': [] } });
    const res = await startSos(h);
    assert.equal(res.status, 422);
    assert.equal(res.json.code, 'NO_CONTACTS');
    assert.match(res.json.error, /call 112/);
    assert.equal(h.provider.calls.length, 0);
  });

  it('does not create a second incident or resend for a duplicate request', async () => {
    const h = await harness();
    const body = startBody(h);
    const first = await api(h, 'POST', '/api/session/start', { token: 'token-a', body });
    const second = await api(h, 'POST', '/api/session/start', { token: 'token-a', body });
    await h.sos.waitForIdle();
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.json.reused, true);
    assert.equal(second.json.sessionId, first.json.sessionId);
    assert.equal(h.provider.calls.length, 2);
  });

  it('marks alerts rate-limited instead of sending after too many incidents in an hour', async () => {
    const h = await harness({ env: { SMS_MAX_INCIDENTS_PER_HOUR: '1' } });
    await startSos(h);
    const second = await startSos(h);
    assert.equal(h.provider.calls.length, 2);
    const alerts = await api(h, 'GET', `/api/session/${second.json.sessionId}/alerts`, { token: 'token-a' });
    assert.deepEqual(alerts.json.deliveries.map((d) => d.status), ['rate_limited', 'rate_limited']);
  });
});

describe('offline-first delayed sync', () => {
  it('states both the phone activation time and server receipt time when the SOS arrives late', async () => {
    const h = await harness();
    const pressedAt = START - 30 * 60 * 1000;
    const res = await startSos(h, 'token-a', {
      deviceActivatedAt: pressedAt,
      location: { latitude: 28.61, longitude: 77.2, accuracy: 9, timestamp: pressedAt - 2000 },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.activatedAt, START);
    assert.equal(res.json.deviceActivatedAt, pressedAt);
    assert.equal(res.json.location.status, 'STALE');
    const body = h.provider.calls[0].body;
    assert.match(
      body,
      /DELAYED ALERT: Asha Verma pressed SOS on their phone at 11 Oct 2026 11:00:00 GMT\+5:30 \(phone clock\)\. It reached the SOS-Vidha server at 11 Oct 2026 11:30:00 GMT\+5:30\./
    );
    assert.match(body, /Location: STALE - last GPS fix was 30 min before this alert was sent/);
    const incident = await h.incidents.getIncident(res.json.sessionId);
    assert.equal(incident.deviceActivatedAt, pressedAt);
    assert.equal(incident.activatedAt, START);
  });

  it('does not add a delay notice for a prompt sync', async () => {
    const h = await harness();
    await startSos(h, 'token-a', { deviceActivatedAt: START - 20 * 1000 });
    assert.doesNotMatch(h.provider.calls[0].body, /DELAYED/);
    assert.match(h.provider.calls[0].body, /Asha Verma activated SOS at 11 Oct 2026 11:30:00/);
  });

  it('ignores implausible phone clocks instead of trusting them', async () => {
    const h = await harness();
    const future = await startSos(h, 'token-a', { deviceActivatedAt: START + 10 * 60 * 1000 });
    const ancient = await startSos(h, 'token-a', { deviceActivatedAt: START - 8 * 24 * 60 * 60 * 1000 });
    const junk = await startSos(h, 'token-a', { deviceActivatedAt: 'yesterday' });
    for (const res of [future, ancient, junk]) {
      assert.equal(res.status, 201);
      assert.equal(res.json.deviceActivatedAt, null);
    }
    assert.ok(h.provider.calls.every((c) => !/DELAYED/.test(c.body)));
  });

  it('confirms an already-recorded incident on retry after the live session is gone, without resending', async () => {
    const h = await harness();
    const body = startBody(h, { deviceActivatedAt: START - 60 * 1000 });
    const first = await api(h, 'POST', '/api/session/start', { token: 'token-a', body });
    await h.sos.waitForIdle();
    assert.equal(first.status, 201);
    // Simulates the phone never seeing the first response, then a server restart dropping in-memory sessions.
    h.sos.sessionStore.sessions.delete(first.json.sessionId);
    h.clock.t += 5 * 60 * 1000;
    const retry = await api(h, 'POST', '/api/session/start', { token: 'token-a', body });
    await h.sos.waitForIdle();
    assert.equal(retry.status, 409);
    assert.equal(retry.json.code, 'INCIDENT_EXISTS');
    assert.equal(retry.json.incidentId, first.json.sessionId);
    assert.equal(retry.json.disarmToken, undefined);
    assert.equal(h.provider.calls.length, 2);
    const alerts = await api(h, 'GET', `/api/session/${first.json.sessionId}/alerts`, { token: 'token-a' });
    assert.equal(alerts.status, 200);
    assert.equal(alerts.json.deliveries.length, 2);
  });

  it('creates exactly one incident when the same sync is retried concurrently', async () => {
    const h = await harness();
    const body = startBody(h);
    const results = await Promise.all(
      [0, 1, 2].map(() => api(h, 'POST', '/api/session/start', { token: 'token-a', body }))
    );
    await h.sos.waitForIdle();
    const statuses = results.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.ok(statuses.every((s) => [200, 201, 409].includes(s)));
    const ids = new Set(results.map((r) => r.json.sessionId || r.json.incidentId));
    assert.equal(ids.size, 1);
    assert.equal(h.provider.calls.length, 2);
  });

  it("keeps the same client incident ID separate per user and never exposes another user's incident", async () => {
    const h = await harness();
    const body = startBody(h);
    const a = await api(h, 'POST', '/api/session/start', { token: 'token-a', body });
    const b = await api(h, 'POST', '/api/session/start', { token: 'token-b', body });
    await h.sos.waitForIdle();
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(b.json.sessionId, a.json.sessionId);
    assert.notEqual(b.json.disarmToken, a.json.disarmToken);
    const peek = await api(h, 'GET', `/api/session/${a.json.sessionId}/alerts`, { token: 'token-b' });
    assert.equal(peek.status, 404);
    const sentToB = h.provider.calls.filter((c) => c.to === '+919800000099');
    assert.equal(sentToB.length, 1);
  });

  it('rejects a sync with an expired token without recording or sending, then accepts it after re-auth', async () => {
    const h = await harness();
    const body = startBody(h);
    const expired = await api(h, 'POST', '/api/session/start', { token: 'expired-token', body });
    assert.equal(expired.status, 401);
    assert.equal(h.provider.calls.length, 0);
    assert.equal(h.incidents.incidents.size, 0);
    const retry = await api(h, 'POST', '/api/session/start', { token: 'token-a', body });
    await h.sos.waitForIdle();
    assert.equal(retry.status, 201);
    assert.equal(h.provider.calls.length, 2);
  });

  it('exposes provider message IDs to the owner only', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const alerts = await api(h, 'GET', `/api/session/${json.sessionId}/alerts`, { token: 'token-a' });
    assert.deepEqual(alerts.json.deliveries.map((d) => d.providerMessageId).sort(), ['SM1', 'SM2']);
    const tracker = await api(h, 'GET', `/api/session/${json.sessionId}?t=${trackerToken(json.trackingUrl)}`);
    assert.equal(tracker.status, 200);
    assert.ok(!tracker.text.includes('SM1'));
  });
});

describe('SMS provider failure', () => {
  it('keeps the incident and reports failed deliveries honestly', async () => {
    const err = Object.assign(new Error('invalid number'), { status: 400, code: 21211 });
    const h = await harness({ provider: fakeProvider(err) });
    const res = await startSos(h);
    assert.equal(res.status, 201);
    const incident = await h.incidents.getIncident(res.json.sessionId);
    assert.equal(incident.status, 'EMERGENCY');
    const alerts = await api(h, 'GET', `/api/session/${res.json.sessionId}/alerts`, { token: 'token-a' });
    assert.equal(alerts.status, 200);
    assert.deepEqual(alerts.json.deliveries.map((d) => d.status), ['failed', 'failed']);
    assert.ok(alerts.json.deliveries.every((d) => d.to.startsWith('*')));
  });

  it('returns a clear error and sends nothing when the incident cannot be persisted', async () => {
    const h = await harness();
    h.incidents.createIncident = async () => {
      throw new Error('db down');
    };
    const res = await startSos(h);
    assert.equal(res.status, 503);
    assert.equal(res.json.code, 'INCIDENT_NOT_PERSISTED');
    assert.match(res.json.error, /call 112/);
    assert.equal(h.provider.calls.length, 0);
  });
});

describe('cross-user access', () => {
  it("prevents another user from reading or controlling an incident", async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const id = json.sessionId;

    assert.equal((await api(h, 'GET', `/api/session/${id}`, { token: 'token-b' })).status, 403);
    assert.equal((await api(h, 'GET', `/api/session/${id}`)).status, 403);
    assert.equal((await api(h, 'GET', `/api/session/${id}/alerts`, { token: 'token-b' })).status, 404);
    assert.equal((await api(h, 'GET', `/api/session/${id}/alerts`)).status, 401);
    const disarm = await api(h, 'POST', '/api/session/disarm', {
      token: 'token-b',
      body: { sessionId: id, method: 'BIOMETRIC', disarmToken: json.disarmToken },
    });
    assert.equal(disarm.status, 403);
    const whatsapp = await api(h, 'POST', '/api/notify/whatsapp', { token: 'token-b', body: { sessionId: id } });
    assert.equal(whatsapp.status, 404);
    assert.equal((await api(h, 'GET', `/track/${id}`, { token: 'token-b' })).status, 403);

    const owner = await api(h, 'GET', `/api/session/${id}`, { token: 'token-a' });
    assert.equal(owner.status, 200);
  });

  it('blocks another user from joining the owner socket room', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const intruder = await connect(h, { token: 'token-b' });
    intruder.emit('join-room', { sessionId: json.sessionId });
    const err = await once(intruder, 'ERROR');
    assert.equal(err.code, 'UNAUTHORIZED');
    const anon = await connect(h);
    anon.emit('join-room', { sessionId: json.sessionId });
    assert.equal((await once(anon, 'ERROR')).code, 'UNAUTHORIZED');
  });
});

describe('WhatsApp endpoint', () => {
  it('requires authentication and ignores client-supplied recipients and message', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const anon = await api(h, 'POST', '/api/notify/whatsapp', {
      body: { sessionId: json.sessionId, contacts: ['+15550001111'], message: 'spam' },
    });
    assert.equal(anon.status, 401);

    const before = h.provider.calls.length;
    const res = await api(h, 'POST', '/api/notify/whatsapp', {
      token: 'token-a',
      body: { sessionId: json.sessionId, contacts: ['+15550001111'], message: 'spam' },
    });
    assert.equal(res.status, 200);
    const sent = h.provider.calls.slice(before);
    assert.deepEqual(sent.map((c) => c.to).sort(), ['+919800000001', '+919800000002']);
    assert.ok(sent.every((c) => c.channel === 'whatsapp' && !c.body.includes('spam')));

    await api(h, 'POST', '/api/notify/whatsapp', { token: 'token-a', body: { sessionId: json.sessionId } });
    assert.equal(h.provider.calls.length, before + 2);
  });
});

describe('tracking capability', () => {
  it('grants read-only access with a valid capability and hides owner-only fields', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const t = trackerToken(json.trackingUrl);

    const read = await api(h, 'GET', `/api/session/${json.sessionId}?t=${t}`);
    assert.equal(read.status, 200);
    assert.equal(read.json.trackingUrl, undefined);
    assert.equal(read.json.disarmToken, undefined);
    assert.equal(read.json.location.latitude, 28.61);
    assert.equal(read.headers.get('cache-control'), 'no-store');
    assert.equal(read.headers.get('referrer-policy'), 'no-referrer');

    const page = await api(h, 'GET', `/track/${json.sessionId}?t=${t}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /<meta name="referrer" content="strict-origin"\/>/);
    assert.equal(page.headers.get('referrer-policy'), 'strict-origin');
  });

  it('rejects invalid, expired and revoked capabilities', async () => {
    const h = await harness({ env: { TRACKER_TOKEN_TTL_MS: '60000' } });
    const { json } = await startSos(h);
    const t = trackerToken(json.trackingUrl);

    assert.equal((await api(h, 'GET', `/api/session/${json.sessionId}?t=${'0'.repeat(64)}`)).status, 403);
    assert.equal((await api(h, 'GET', `/track/${json.sessionId}?t=wrong`)).status, 403);

    h.clock.t += 61000;
    assert.equal((await api(h, 'GET', `/api/session/${json.sessionId}?t=${t}`)).status, 403);
    assert.equal((await api(h, 'GET', `/track/${json.sessionId}?t=${t}`)).status, 403);

    const h2 = await harness();
    const second = (await startSos(h2)).json;
    const t2 = trackerToken(second.trackingUrl);
    assert.equal((await api(h2, 'GET', `/api/session/${second.sessionId}?t=${t2}`)).status, 200);
    const disarm = await api(h2, 'POST', '/api/session/disarm', {
      token: 'token-a',
      body: { sessionId: second.sessionId, method: 'BIOMETRIC', disarmToken: second.disarmToken },
    });
    assert.equal(disarm.status, 200);
    assert.equal((await api(h2, 'GET', `/api/session/${second.sessionId}?t=${t2}`)).status, 403);
    const incident = await h2.incidents.getIncident(second.sessionId);
    assert.equal(incident.status, 'DISARMED');
    assert.ok(incident.trackerRevokedAt);
  });

  it('does not let a tracker publish location, trigger SOS or join the owner room', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const t = trackerToken(json.trackingUrl);
    const tracker = await connect(h);
    tracker.emit('join-tracker', { sessionId: json.sessionId, trackerToken: t });
    const snapshot = await once(tracker, 'TRACKER_SNAPSHOT');
    assert.equal(snapshot.location.latitude, 28.61);

    tracker.emit('location-stream', { latitude: 10, longitude: 10, timestamp: h.clock.t });
    assert.equal((await once(tracker, 'ERROR')).code, 'UNAUTHORIZED');
    tracker.emit('sos-trigger', { reason: 'FAKE' });
    assert.equal((await once(tracker, 'ERROR')).code, 'UNAUTHORIZED');
    tracker.emit('client-status', { status: 'MONITORING' });
    assert.equal((await once(tracker, 'ERROR')).code, 'UNAUTHORIZED');
    tracker.emit('join-room', { sessionId: json.sessionId });
    assert.equal((await once(tracker, 'ERROR')).code, 'UNAUTHORIZED');

    const session = h.sos.sessionStore.get(json.sessionId);
    assert.equal(session.location.latitude, 28.61);
    assert.equal(session.status, 'EMERGENCY');

    const disarm = await api(h, 'POST', '/api/session/disarm', {
      token: 'token-b',
      body: { sessionId: json.sessionId, method: 'BIOMETRIC', disarmToken: json.disarmToken },
    });
    assert.equal(disarm.status, 403);
  });

  it('streams owner updates to trackers but not alert details, and ends tracking on disarm', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const t = trackerToken(json.trackingUrl);

    const owner = await connect(h, { token: 'token-a' });
    owner.emit('join-room', { sessionId: json.sessionId });
    await once(owner, 'ROOM_JOINED');

    const tracker = await connect(h);
    tracker.emit('join-tracker', { sessionId: json.sessionId, trackerToken: t });
    await once(tracker, 'TRACKER_SNAPSHOT');
    let trackerGotAlertStatus = false;
    tracker.on('ALERT_STATUS', () => {
      trackerGotAlertStatus = true;
    });

    const update = once(tracker, 'LOCATION_UPDATE');
    owner.emit('location-stream', { latitude: 28.62, longitude: 77.21, accuracy: 7, timestamp: h.clock.t });
    assert.equal((await update).location.latitude, 28.62);

    const ownerStatus = once(owner, 'ALERT_STATUS');
    await api(h, 'POST', '/api/notify/whatsapp', { token: 'token-a', body: { sessionId: json.sessionId } });
    await ownerStatus;
    assert.equal(trackerGotAlertStatus, false);

    const ended = once(tracker, 'TRACKING_ENDED');
    const disconnected = once(tracker, 'disconnect');
    await api(h, 'POST', '/api/session/disarm', {
      token: 'token-a',
      body: { sessionId: json.sessionId, method: 'BIOMETRIC', disarmToken: json.disarmToken },
    });
    await ended;
    await disconnected;

    const again = await connect(h);
    again.emit('join-tracker', { sessionId: json.sessionId, trackerToken: t });
    assert.equal((await once(again, 'ERROR')).code, 'UNAUTHORIZED');
  });

  it('expires tracker sockets during maintenance', async () => {
    const h = await harness({ env: { TRACKER_TOKEN_TTL_MS: '60000' } });
    const { json } = await startSos(h);
    const tracker = await connect(h);
    tracker.emit('join-tracker', { sessionId: json.sessionId, trackerToken: trackerToken(json.trackingUrl) });
    await once(tracker, 'TRACKER_SNAPSHOT');
    const ended = once(tracker, 'TRACKING_ENDED');
    h.clock.t += 61000;
    h.sos.runMaintenance();
    await ended;
  });
});

describe('provider status callbacks', () => {
  it('rejects unsigned callbacks and applies verified ones', async () => {
    const h = await harness();
    const { json } = await startSos(h);
    const form = (sig) =>
      fetch(`${h.base}/api/twilio/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(sig ? { 'X-Twilio-Signature': sig } : {}) },
        body: 'MessageSid=SM1&MessageStatus=delivered',
      });
    assert.equal((await form(null)).status, 403);
    assert.equal((await form('forged')).status, 403);
    let alerts = await api(h, 'GET', `/api/session/${json.sessionId}/alerts`, { token: 'token-a' });
    assert.ok(alerts.json.deliveries.every((d) => d.status === 'accepted'));

    assert.equal((await form('valid-signature')).status, 204);
    alerts = await api(h, 'GET', `/api/session/${json.sessionId}/alerts`, { token: 'token-a' });
    assert.equal(alerts.json.deliveries.filter((d) => d.status === 'delivered').length, 1);
  });
});

describe('dry-run safety', () => {
  it('never contacts the provider when live sending is disabled', async () => {
    const h = await harness({ env: { SMS_LIVE_SEND: 'false' } });
    const { json } = await startSos(h);
    assert.equal(json.alerts.mode, 'dry_run');
    assert.equal(h.provider.calls.length, 0);
    const alerts = await api(h, 'GET', `/api/session/${json.sessionId}/alerts`, { token: 'token-a' });
    assert.deepEqual(alerts.json.deliveries.map((d) => d.status), ['dry_run', 'dry_run']);
  });
});
