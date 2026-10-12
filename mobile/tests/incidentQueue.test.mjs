import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNC_STATUS,
  RECIPIENT_STATUS,
  createIncidentRecord,
  locationFromCapture,
  locationForSync,
  describeIncident,
  describeIncidentLocation,
  buildDeviceSmsBody,
  acceptTrackingUrl,
  trackingUrlForIncident,
  deviceSmsOffer,
  interpretComposerResult,
  ledgerEntryFromServer,
  formatClock,
} from '../services/incidents/incidentModel.js';
import { createIncidentRepository, createMemoryStorage, INDEX_KEY } from '../services/incidents/incidentRepository.js';
import { createIncidentSyncer, classifySyncError, buildSyncPayload } from '../services/incidents/incidentSync.js';

const T0 = Date.UTC(2026, 9, 11, 6, 0, 0);
const IST = 330;
const ID = '6f1c2a7e-0b9d-4c55-9a43-1d2e3f4a5b6c';
const ID2 = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const CONTACTS = [
  { id: 'c1', name: 'Ravi', phone: '+919800000001' },
  { id: 'c2', name: 'Meera', phone: '+919800000002' },
];
const FIX = { latitude: 28.61, longitude: 77.2, accuracy: 12, timestamp: T0 - 3000 };

function networkError() {
  return new Error('Safety server request timed out.');
}

function httpError(status, code = null, extra = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { status, code, ...extra });
}

/** Mirrors the backend's per-user clientRequestId idempotency and counts notifications sent. */
function fakeServer(clock) {
  const byKey = new Map();
  const live = new Set();
  const s = {
    calls: [],
    notifications: 0,
    mode: 'ok',
    userId: 'user-a',
    deliveries: [],
    async syncIncident(payload) {
      s.calls.push(payload);
      if (s.mode === 'offline') throw networkError();
      if (s.mode === 'expired') throw httpError(401);
      if (s.mode === 'no-contacts') throw httpError(422, 'NO_CONTACTS');
      const key = `${s.userId}:${payload.clientRequestId}`;
      if (byKey.has(key)) {
        const id = byKey.get(key);
        if (live.has(id)) {
          return {
            sessionId: id,
            activatedAt: clock.t,
            reused: true,
            disarmToken: 'disarm-secret',
            deliveries: s.deliveries,
          };
        }
        throw httpError(409, 'INCIDENT_EXISTS', { incidentId: id });
      }
      const id = `srv-${byKey.size + 1}`;
      byKey.set(key, id);
      live.add(id);
      s.notifications += 2;
      if (s.mode === 'save-then-timeout') {
        s.mode = 'ok';
        throw networkError();
      }
      return {
        sessionId: id,
        activatedAt: clock.t,
        deviceActivatedAt: payload.deviceActivatedAt,
        disarmToken: 'disarm-secret',
        trackingUrl: `https://sos.example.org/track/${id}?t=tracker-secret`,
      };
    },
    async getAlertStatus() {
      return { deliveries: s.deliveries };
    },
    dropLiveSessions() {
      live.clear();
    },
    incidentCount() {
      return byKey.size;
    },
  };
  return s;
}

function setup({ storage = createMemoryStorage(), auth = { required: true, signedIn: true, userId: 'user-a' } } = {}) {
  const clock = { t: T0 };
  const now = () => clock.t;
  const repo = createIncidentRepository(storage);
  const server = fakeServer(clock);
  const authState = { ...auth };
  const syncer = createIncidentSyncer({
    repo,
    api: server,
    getAuth: () => authState,
    buildRequestExtras: async () => ({ pinSalt: 's', standardPinHash: 'a'.repeat(64), duressPinHash: 'b'.repeat(64) }),
    now,
  });
  return { storage, repo, server, syncer, clock, authState };
}

async function activate(env, { id = ID, capture = { location: FIX, locationError: null } } = {}) {
  await env.repo.create(createIncidentRecord({ id, userId: 'user-a', activatedAt: env.clock.t, contacts: CONTACTS }));
  return env.repo.update(id, (r) => ({ ...r, location: locationFromCapture(capture) }));
}

describe('durable local incident record', () => {
  it('is saved before any network call and survives a simulated restart', async () => {
    const env = setup();
    env.server.mode = 'offline';
    await activate(env);
    assert.equal(env.server.calls.length, 0);

    const restarted = createIncidentRepository(createMemoryStorage(env.storage.snapshot()));
    const [record] = await restarted.list();
    assert.equal(record.id, ID);
    assert.equal(record.status, SYNC_STATUS.LOCAL_ONLY);
    assert.equal(record.activatedAt, T0);
    assert.equal(record.location.capturedAt, FIX.timestamp);
    assert.ok(record.ledger.every((e) => e.status === RECIPIENT_STATUS.QUEUED_LOCALLY));
  });

  it('stores no phone numbers, tokens or tracking links', async () => {
    const env = setup();
    await activate(env);
    await env.syncer.syncIncident(ID);
    const stored = JSON.stringify(env.storage.snapshot());
    assert.doesNotMatch(stored, /\+9198/);
    assert.doesNotMatch(stored, /disarm-secret|tracker-secret|\/track\//);
  });

  it('records a crash during GPS capture as pending, not as a location', async () => {
    const env = setup();
    await env.repo.create(createIncidentRecord({ id: ID, userId: 'user-a', activatedAt: T0, contacts: CONTACTS }));
    const record = await env.repo.get(ID);
    assert.equal(record.location.status, 'PENDING');
    assert.deepEqual(locationForSync(record), { location: null, locationError: null });
  });

  it('skips a corrupt entry without losing the others', async () => {
    const env = setup();
    await activate(env);
    await activate(env, { id: ID2 });
    await env.storage.setItem(`sosvidha.incident.${ID2}`, '{not json');
    const list = await env.repo.list();
    assert.deepEqual(list.map((r) => r.id), [ID]);
  });

  it('never prunes unsent incidents', async () => {
    const storage = createMemoryStorage();
    const repo = createIncidentRepository(storage, { maxKept: 2 });
    for (let i = 0; i < 4; i += 1) {
      await repo.create(createIncidentRecord({ id: `incident-000${i}`, activatedAt: T0 + i }));
    }
    assert.equal((await repo.list()).length, 4);
    assert.equal(JSON.parse(await storage.getItem(INDEX_KEY)).length, 4);
  });
});

describe('GPS honesty', () => {
  it('stores denied or missing GPS as unavailable and never invents coordinates', () => {
    assert.deepEqual(locationFromCapture({ location: null, locationError: 'PERMISSION_DENIED' }), {
      status: 'UNAVAILABLE',
      reason: 'PERMISSION_DENIED',
    });
    assert.equal(locationFromCapture({ location: { latitude: 0, longitude: 0, timestamp: T0 } }).status, 'UNAVAILABLE');
    assert.equal(locationFromCapture({ location: { latitude: 28.6, longitude: 77.2 } }).reason, 'INVALID_FIX');
    assert.equal(locationFromCapture({ location: null, locationError: 'SOMETHING' }).reason, 'NOT_PROVIDED');
  });

  it('sends the device error, not coordinates, when GPS is unavailable', async () => {
    const env = setup();
    await activate(env, { capture: { location: null, locationError: 'TIMEOUT' } });
    await env.syncer.syncIncident(ID);
    const payload = env.server.calls[0];
    assert.equal(payload.location, undefined);
    assert.equal(payload.locationError, 'TIMEOUT');
  });

  it('labels an old fix with its real capture time and age', async () => {
    const env = setup();
    await activate(env, { capture: { location: { ...FIX, timestamp: T0 - 25 * 60000 } } });
    const record = await env.repo.get(ID);
    const text = describeIncidentLocation(record, { nowMs: T0, offsetMinutes: IST });
    assert.match(text, /GPS fix at 11 Oct 2026 11:05:00 UTC\+05:30 \(±12 m, 25 min ago\)/);
    const sms = buildDeviceSmsBody(record, { nowMs: T0 + 5 * 60000, offsetMinutes: IST });
    assert.match(sms, /30 min before this message/);
    assert.match(sms, /maps\.google\.com\/\?q=28\.61000,77\.20000/);
    assert.doesNotMatch(sms, /track|http.*\?t=/);
  });

  it('says location unavailable in the device SMS instead of a map link', async () => {
    const env = setup();
    await activate(env, { capture: { location: null, locationError: 'PERMISSION_DENIED' } });
    const sms = buildDeviceSmsBody(await env.repo.get(ID), { nowMs: T0, offsetMinutes: IST });
    assert.match(sms, /Location: UNAVAILABLE \(location permission was denied\)/);
    assert.doesNotMatch(sms, /maps\.google/);
  });
});

describe('offline activation and later sync', () => {
  it('waits for the network, then reports success only after the server confirms', async () => {
    const env = setup();
    env.server.mode = 'offline';
    await activate(env);
    const first = await env.syncer.syncIncident(ID);
    assert.equal(first.record.status, SYNC_STATUS.WAITING_FOR_NETWORK);
    assert.equal(first.record.sync.nextAttemptAt, T0 + 5000);
    assert.equal(first.session, null);
    assert.match(describeIncident(first.record, { offsetMinutes: IST }).text, /No alert is confirmed as sent/);

    env.server.mode = 'ok';
    env.clock.t += 2000;
    assert.deepEqual(await env.syncer.syncDue(), []);
    env.clock.t += 3000;
    const [later] = await env.syncer.syncDue();
    assert.equal(later.record.status, SYNC_STATUS.SERVER_RECEIVED);
    assert.equal(later.record.server.incidentId, 'srv-1');
    assert.equal(later.record.server.deviceActivatedAt, T0);
    assert.equal(later.session.disarmToken, 'disarm-secret');
    assert.equal(env.server.calls[1].deviceActivatedAt, T0);
    assert.equal(env.server.calls[1].clientRequestId, ID);
  });

  it('stops automatic retries after the limit and keeps the record', async () => {
    const env = setup();
    env.server.mode = 'offline';
    await activate(env);
    for (let i = 0; i < 10; i += 1) {
      await env.syncer.syncDue();
      env.clock.t += 10 * 60000;
    }
    assert.equal(env.server.calls.length, 6);
    const record = await env.repo.get(ID);
    assert.equal(record.status, SYNC_STATUS.SYNC_FAILED);
    assert.equal(record.statusReason, 'RETRY_LIMIT');
    env.server.mode = 'ok';
    const manual = await env.syncer.syncIncident(ID);
    assert.equal(manual.record.status, SYNC_STATUS.SERVER_RECEIVED);
  });
});

describe('repeated sync and duplicate prevention', () => {
  it('sends one request for concurrent sync triggers', async () => {
    const env = setup();
    await activate(env);
    await Promise.all([env.syncer.syncIncident(ID), env.syncer.syncIncident(ID), env.syncer.syncDue()]);
    assert.equal(env.server.calls.length, 1);
    assert.equal(env.server.notifications, 2);
  });

  it('does not resend after success', async () => {
    const env = setup();
    await activate(env);
    await env.syncer.syncIncident(ID);
    await env.syncer.syncIncident(ID);
    await env.syncer.syncDue();
    assert.equal(env.server.calls.length, 1);
  });

  it('recovers from a timeout after the server already saved the incident, without duplicate alerts', async () => {
    const env = setup();
    env.server.mode = 'save-then-timeout';
    await activate(env);
    const first = await env.syncer.syncIncident(ID);
    assert.equal(first.record.status, SYNC_STATUS.WAITING_FOR_NETWORK);
    assert.equal(first.record.sync.ambiguous, true);
    assert.match(describeIncident(first.record).text, /may already have been alerted/);

    env.server.dropLiveSessions();
    env.clock.t += 5000;
    const [retry] = await env.syncer.syncDue();
    assert.equal(retry.record.status, SYNC_STATUS.SERVER_RECEIVED);
    assert.equal(retry.record.statusReason, 'DELIVERY_UNCONFIRMED');
    assert.equal(retry.record.server.incidentId, 'srv-1');
    assert.equal(retry.session, null);
    assert.equal(describeIncident(retry.record).tone, 'warning');
    assert.match(describeIncident(retry.record).text, /did not get proof/);
    assert.equal(env.server.incidentCount(), 1);
    assert.equal(env.server.notifications, 2);
  });

  it('a retry of a live incident returns the stored notification state and does not send again', async () => {
    const env = setup();
    env.server.mode = 'save-then-timeout';
    await activate(env);
    await env.syncer.syncIncident(ID);
    env.server.deliveries = [{ id: 'd1', channel: 'sms', status: 'accepted', recipientName: 'Ravi' }];
    env.clock.t += 5000;
    const [retry] = await env.syncer.syncDue();
    assert.equal(env.server.calls.length, 2);
    assert.equal(env.server.notifications, 2);
    assert.equal(retry.record.status, SYNC_STATUS.SERVER_RECEIVED);
    const row = retry.record.ledger.find((entry) => entry.recipientName === 'Ravi');
    assert.equal(row.status, RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER);
    assert.notEqual(row.status, RECIPIENT_STATUS.DELIVERED);
  });

  it('keeps provider statuses from a 409 and does not call them delivered', async () => {
    const env = setup();
    await activate(env);
    env.server.syncIncident = async () => {
      throw httpError(409, 'INCIDENT_EXISTS', {
        incidentId: 'srv-kept',
        deliveries: [{ id: 'd1', channel: 'sms', status: 'accepted', recipientName: 'Ravi' }],
      });
    };
    const result = await env.syncer.syncIncident(ID);
    assert.equal(result.session, null);
    assert.equal(result.record.status, SYNC_STATUS.SERVER_RECEIVED);
    assert.equal(result.record.statusReason, null);
    const row = result.record.ledger.find((entry) => entry.recipientName === 'Ravi');
    assert.equal(row.status, RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER);
    assert.notEqual(row.status, RECIPIENT_STATUS.DELIVERED);
    assert.match(describeIncident(result.record).text, /Check each contact/);
  });

  it('safely resumes a send interrupted by an app kill', async () => {
    const env = setup();
    await activate(env);
    await env.repo.update(ID, (r) => ({ ...r, status: SYNC_STATUS.SYNCING, sync: { ...r.sync, attempts: 1 } }));
    await env.server.syncIncident(buildSyncPayload(await env.repo.get(ID), {}));
    const restarted = setup({ storage: createMemoryStorage(env.storage.snapshot()) });
    restarted.server.syncIncident = env.server.syncIncident;
    await restarted.syncer.recoverInterrupted();
    const recovered = await restarted.repo.get(ID);
    assert.equal(recovered.status, SYNC_STATUS.WAITING_FOR_NETWORK);
    assert.equal(recovered.statusReason, 'INTERRUPTED');
    const [result] = await restarted.syncer.syncDue();
    assert.equal(result.record.status, SYNC_STATUS.SERVER_RECEIVED);
    assert.equal(env.server.incidentCount(), 1);
    assert.equal(env.server.notifications, 2);
  });
});

describe('auth and ownership', () => {
  it('keeps the record when the session expires mid-sync and resumes after sign-in', async () => {
    const env = setup();
    env.server.mode = 'expired';
    await activate(env);
    const r1 = await env.syncer.syncIncident(ID);
    assert.equal(r1.record.status, SYNC_STATUS.SYNC_FAILED);
    assert.equal(r1.record.statusReason, 'AUTH_REQUIRED');
    assert.match(describeIncident(r1.record).text, /Sign in again/);

    env.server.mode = 'ok';
    const [r2] = await env.syncer.syncDue();
    assert.equal(r2.record.status, SYNC_STATUS.SERVER_RECEIVED);
  });

  it('does not call the server while signed out', async () => {
    const env = setup({ auth: { required: true, signedIn: false, userId: null } });
    await activate(env);
    const r = await env.syncer.syncIncident(ID);
    assert.equal(r.record.statusReason, 'AUTH_REQUIRED');
    assert.equal(env.server.calls.length, 0);
  });

  it("refuses to send one user's incident under another user's account", async () => {
    const env = setup({ auth: { required: true, signedIn: true, userId: 'user-b' } });
    await activate(env);
    const r = await env.syncer.syncIncident(ID);
    assert.equal(r.record.status, SYNC_STATUS.SYNC_FAILED);
    assert.equal(r.record.statusReason, 'ACCOUNT_MISMATCH');
    assert.equal(env.server.calls.length, 0);
    assert.deepEqual(await env.syncer.syncDue(), []);
  });

  it('stops on missing server contacts and tells the user', async () => {
    const env = setup();
    env.server.mode = 'no-contacts';
    await activate(env);
    const r = await env.syncer.syncIncident(ID);
    assert.equal(r.record.statusReason, 'NO_CONTACTS');
    assert.deepEqual(await env.syncer.syncDue(), []);
  });

  it('classifies errors without treating ambiguous failures as unsent', () => {
    assert.deepEqual(classifySyncError(networkError()), { outcome: 'RETRY', reason: 'NETWORK', ambiguous: true });
    assert.equal(classifySyncError(httpError(502)).ambiguous, true);
    assert.equal(classifySyncError(httpError(503, 'INCIDENT_NOT_PERSISTED')).ambiguous, false);
    assert.equal(classifySyncError(httpError(409, 'INCIDENT_EXISTS', { incidentId: 'x' })).outcome, 'RECORDED_UNCONFIRMED');
    assert.equal(classifySyncError(httpError(403)).outcome, 'STOP');
  });
});

describe('per-recipient ledger', () => {
  it('maps server statuses without overstating delivery', () => {
    const map = (status) => ledgerEntryFromServer({ id: 'd', status }).status;
    assert.equal(map('accepted'), RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER);
    assert.equal(map('sent'), RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER);
    assert.equal(ledgerEntryFromServer({ id: 'd', status: 'sent' }).carrierAccepted, true);
    assert.equal(map('delivered'), RECIPIENT_STATUS.DELIVERED);
    assert.equal(map('failed'), RECIPIENT_STATUS.FAILED);
    assert.equal(map('undelivered'), RECIPIENT_STATUS.FAILED);
    assert.equal(map('unconfirmed'), RECIPIENT_STATUS.UNKNOWN);
    assert.equal(map('sending'), RECIPIENT_STATUS.UNKNOWN);
    assert.equal(map('dry_run'), RECIPIENT_STATUS.NOT_ATTEMPTED);
    assert.equal(map('rate_limited'), RECIPIENT_STATUS.NOT_ATTEMPTED);
    assert.equal(map('something_new'), RECIPIENT_STATUS.UNKNOWN);
    const unknown = describeIncident({
      status: SYNC_STATUS.SERVER_RECEIVED,
      activatedAt: T0,
      ledger: [ledgerEntryFromServer({ id: 'd', status: 'unconfirmed', recipientName: 'Ravi' })],
    });
    assert.equal(unknown.tone, 'warning');
    assert.doesNotMatch(`${unknown.title} ${unknown.text}`, /\bdelivered\b/i);
  });

  it('records provider failure and unknown outcomes from the server with message IDs', async () => {
    const env = setup();
    await activate(env);
    await env.syncer.syncIncident(ID);
    env.server.deliveries = [
      { id: 'd1', channel: 'sms', recipientName: 'Ravi', to: '*****0001', status: 'failed', providerErrorCode: 30003, failedAt: T0 + 1000 },
      { id: 'd2', channel: 'sms', recipientName: 'Meera', to: '*****0002', status: 'unconfirmed', providerMessageId: 'SM2' },
    ];
    const record = await env.syncer.refreshDeliveries(ID);
    const byName = Object.fromEntries(record.ledger.map((e) => [e.recipientName, e]));
    assert.equal(byName.Ravi.status, RECIPIENT_STATUS.FAILED);
    assert.equal(byName.Ravi.providerErrorCode, 30003);
    assert.equal(byName.Meera.status, RECIPIENT_STATUS.UNKNOWN);
    assert.equal(byName.Meera.providerMessageId, 'SM2');
    assert.ok(record.ledger.every((e) => e.status !== RECIPIENT_STATUS.QUEUED_LOCALLY));
  });

  it('never marks a device SMS as sent or delivered, even if the composer says "sent"', async () => {
    const env = setup();
    await activate(env);
    const sent = await env.syncer.recordDeviceSms(ID, CONTACTS, 'sent');
    const device = sent.ledger.filter((e) => e.route === 'device_sms');
    assert.equal(device.length, 2);
    assert.ok(device.every((e) => e.status === RECIPIENT_STATUS.UNKNOWN));
    assert.ok(device.every((e) => e.stage === 'handed_to_messages'));
    assert.ok(device.every((e) => e.status !== RECIPIENT_STATUS.DELIVERED));
    assert.ok(device.every((e) => e.status !== RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER));
    assert.equal(deviceSmsOffer(sent).duplicateRisk, true);
    const again = await env.syncer.recordDeviceSms(ID, CONTACTS, 'unknown');
    assert.equal(again.ledger.filter((e) => e.route === 'device_sms').length, 2);
    const cancelled = await env.syncer.recordDeviceSms(ID, CONTACTS, 'cancelled');
    const closed = cancelled.ledger.filter((e) => e.route === 'device_sms');
    assert.ok(closed.every((e) => e.status === RECIPIENT_STATUS.NOT_ATTEMPTED && e.stage === 'composer_closed'));
    assert.equal(deviceSmsOffer(cancelled).duplicateRisk, false);
  });

  it('records a composer failure without calling it delivered', () => {
    const interpreted = interpretComposerResult('failed');
    assert.equal(interpreted.status, RECIPIENT_STATUS.FAILED);
    assert.equal(interpreted.stage, 'composer_failed');
    assert.equal(interpretComposerResult('unknown').stage, 'composer_opened');
    assert.equal(interpretComposerResult(undefined).status, RECIPIENT_STATUS.UNKNOWN);
  });
});

const CAPABILITY = 'ab'.repeat(32);

describe('device SMS text', () => {
  it('uses the real press time, fix time and accuracy, and labels missing GPS', async () => {
    const env = setup();
    await activate(env, { capture: { location: { ...FIX, timestamp: T0 - 25 * 60000 }, locationError: null } });
    const withFix = buildDeviceSmsBody(await env.repo.get(ID), { nowMs: T0, offsetMinutes: IST, profileName: 'Asha' });
    assert.match(withFix, /Asha pressed SOS at 11 Oct 2026 11:30:00 UTC\+05:30/);
    assert.match(withFix, /GPS fix at 11 Oct 2026 11:05:00 UTC\+05:30 \(±12 m, 25 min before this message\)/);
    assert.match(withFix, /maps\.google\.com\/\?q=28\.61000,77\.20000/);
    assert.doesNotMatch(withFix, /Live tracking/);

    await env.repo.update(ID, (r) => ({ ...r, location: locationFromCapture({ location: null, locationError: 'POSITION_UNAVAILABLE' }) }));
    const missing = buildDeviceSmsBody(await env.repo.get(ID), { nowMs: T0, offsetMinutes: IST });
    assert.match(missing, /Location: UNAVAILABLE \(the phone could not get a GPS fix\)/);
    assert.doesNotMatch(missing, /maps\.google|Live tracking/);
  });

  it('includes a tracking link only when it carries a real capability for this incident', async () => {
    const env = setup();
    await activate(env);
    const record = await env.repo.get(ID);
    const good = `https://sos.example.org/track/${ID}?t=${CAPABILITY}`;
    assert.equal(acceptTrackingUrl(good), good);
    assert.equal(acceptTrackingUrl(`https://sos.example.org/track/${ID}`), null);
    assert.equal(acceptTrackingUrl(`https://sos.example.org/track/${ID}?t=short`), null);
    assert.equal(acceptTrackingUrl('http://evil.example/track/' + ID + '?t=' + CAPABILITY), null);
    assert.equal(acceptTrackingUrl(`http://localhost:3001/track/${ID}?t=${CAPABILITY}`), `http://localhost:3001/track/${ID}?t=${CAPABILITY}`);

    const live = { sessionId: 'other', localIncidentId: ID, trackingUrl: good };
    assert.equal(trackingUrlForIncident(record, live), good);
    assert.equal(trackingUrlForIncident(record, { sessionId: 'other', localIncidentId: 'not-this', trackingUrl: good }), null);
    const sms = buildDeviceSmsBody(record, { nowMs: T0, offsetMinutes: IST, trackingUrl: trackingUrlForIncident(record, live) });
    assert.ok(sms.includes(`Live tracking while this SOS is active: ${good}`));
    assert.equal(JSON.stringify(env.storage.snapshot()).includes(CAPABILITY), false);
  });

  it('offers the composer only as a fallback, and flags an unknown attempt as a duplicate risk', async () => {
    const env = setup();
    await activate(env);
    let record = await env.repo.get(ID);
    assert.equal(deviceSmsOffer(record).show, true);
    await env.repo.update(ID, (r) => ({ ...r, status: SYNC_STATUS.SYNCING }));
    assert.equal(deviceSmsOffer(await env.repo.get(ID)).show, false);

    await env.syncer.syncIncident(ID);
    record = await env.syncer.refreshDeliveries(ID);
    env.server.deliveries = [{ id: 'd1', channel: 'sms', status: 'accepted', recipientName: 'Ravi' }];
    record = await env.syncer.refreshDeliveries(ID);
    assert.equal(deviceSmsOffer(record).show, false);

    env.server.deliveries = [{ id: 'd1', channel: 'sms', status: 'failed', recipientName: 'Ravi' }];
    record = await env.syncer.refreshDeliveries(ID);
    assert.equal(deviceSmsOffer(record).show, true);
    assert.equal(deviceSmsOffer(record).duplicateRisk, false);
  });
});

describe('closing locally', () => {
  it('closes an unsent incident without sending it and says so', async () => {
    const env = setup();
    env.server.mode = 'offline';
    await activate(env);
    await env.syncer.closeIncident(ID);
    env.server.mode = 'ok';
    env.clock.t += 60 * 60000;
    assert.deepEqual(await env.syncer.syncDue(), []);
    assert.equal(env.server.calls.length, 0);
    const record = await env.repo.get(ID);
    assert.match(describeIncident(record).text, /never sent to the server/);
  });

  it('warns that an ambiguous attempt may still have reached the server', async () => {
    const env = setup();
    env.server.mode = 'save-then-timeout';
    await activate(env);
    await env.syncer.syncIncident(ID);
    await env.syncer.closeIncident(ID);
    assert.match(describeIncident(await env.repo.get(ID)).text, /may still have reached the server/);
  });
});

describe('formatting', () => {
  it('formats phone-clock times with an explicit offset', () => {
    assert.equal(formatClock(T0, IST), '11 Oct 2026 11:30:00 UTC+05:30');
    assert.equal(formatClock(T0, -300), '11 Oct 2026 01:00:00 UTC-05:00');
  });
});
