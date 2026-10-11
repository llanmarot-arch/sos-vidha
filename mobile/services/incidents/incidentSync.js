import {
  SYNC_STATUS,
  isUnsent,
  locationForSync,
  markServerEntriesAwaitingStatus,
  mergeServerDeliveries,
  recordDeviceSmsAttempt,
} from './incidentModel.js';

/**
 * Sends locally saved incidents to the backend. Safe to repeat: the local incident ID is the server's
 * per-user idempotency key (`clientRequestId`), so a retry after a timeout, crash or restart can only
 * return the incident the server already stored. Retries are bounded; nothing here runs in the background
 * on its own — callers trigger it on app start, return to foreground, reconnect, or a user tap.
 */

export const RETRY_DELAYS_MS = [5000, 15000, 60000, 5 * 60000];
export const MAX_AUTO_ATTEMPTS = 6;

/** Outcome of a failed request: RETRY later, STOP until the user acts, or RECEIVED (server already has it). */
export function classifySyncError(err) {
  const status = err?.status;
  if (status == null) return { outcome: 'RETRY', reason: 'NETWORK', ambiguous: true };
  if (status === 409 && err.code === 'INCIDENT_EXISTS' && err.incidentId) {
    return { outcome: 'RECEIVED', incidentId: err.incidentId };
  }
  if (status === 401) return { outcome: 'STOP', reason: 'AUTH_REQUIRED' };
  if (status === 422) return { outcome: 'STOP', reason: 'NO_CONTACTS' };
  if (status === 429) return { outcome: 'RETRY', reason: 'RATE_LIMITED', ambiguous: false };
  if (status === 503 && err.code === 'CONTACTS_UNAVAILABLE') {
    return { outcome: 'RETRY', reason: 'CONTACTS_UNAVAILABLE', ambiguous: false };
  }
  if (status === 503 && err.code === 'INCIDENT_NOT_PERSISTED') {
    return { outcome: 'RETRY', reason: 'SERVER_UNAVAILABLE', ambiguous: false };
  }
  // A proxy 5xx can arrive after the backend already stored the incident.
  if (status >= 500) return { outcome: 'RETRY', reason: 'SERVER_UNAVAILABLE', ambiguous: true };
  return { outcome: 'STOP', reason: 'REJECTED' };
}

export function buildSyncPayload(record, extras = {}) {
  const { location, locationError } = locationForSync(record);
  const payload = {
    mode: 'GEOFENCE',
    clientRequestId: record.id,
    emergency: true,
    deviceActivatedAt: record.activatedAt,
    pinSalt: extras.pinSalt,
    standardPinHash: extras.standardPinHash,
    duressPinHash: extras.duressPinHash,
  };
  if (location) payload.location = location;
  if (locationError) payload.locationError = locationError;
  if (extras.contact1) payload.contact1 = extras.contact1;
  if (extras.contact2) payload.contact2 = extras.contact2;
  return payload;
}

function retryDelay(attempts, delays) {
  return delays[Math.min(Math.max(attempts - 1, 0), delays.length - 1)];
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./incidentRepository.js').createIncidentRepository>} deps.repo
 * @param {{ syncIncident(payload): Promise<object>, getAlertStatus(id): Promise<object> }} deps.api
 * @param {() => { required: boolean, signedIn: boolean, userId: string|null }} deps.getAuth
 * @param {(record) => Promise<object>} deps.buildRequestExtras PIN hashes (and legacy contacts) computed at send time, never stored
 */
export function createIncidentSyncer({
  repo,
  api,
  getAuth,
  buildRequestExtras = async () => ({}),
  now = Date.now,
  retryDelays = RETRY_DELAYS_MS,
  maxAutoAttempts = MAX_AUTO_ATTEMPTS,
}) {
  const inFlight = new Map();
  const update = (id, fn) => repo.update(id, fn, { now });

  function fail(id, reason, { ambiguous = false } = {}) {
    return update(id, (r) => ({
      ...r,
      status: SYNC_STATUS.SYNC_FAILED,
      statusReason: reason,
      sync: { ...r.sync, nextAttemptAt: null, ambiguous: r.sync.ambiguous || ambiguous, lastError: reason },
    }));
  }

  function markReceived(id, server) {
    return update(id, (r) => ({
      ...r,
      status: SYNC_STATUS.SERVER_RECEIVED,
      statusReason: null,
      server,
      ledger: markServerEntriesAwaitingStatus(r.ledger),
      sync: { ...r.sync, nextAttemptAt: null, lastError: null },
    }));
  }

  async function attempt(id) {
    const record = await repo.get(id);
    if (!record || !isUnsent(record)) return { record, session: null };

    const auth = getAuth();
    if (auth.required && !auth.signedIn) {
      return { record: await fail(id, 'AUTH_REQUIRED'), session: null };
    }
    if (auth.required && record.userId !== auth.userId) {
      return { record: await fail(id, 'ACCOUNT_MISMATCH'), session: null };
    }

    let extras;
    try {
      extras = await buildRequestExtras(record);
    } catch {
      return { record: await fail(id, 'REJECTED'), session: null };
    }

    const syncing = await update(id, (r) => ({
      ...r,
      status: SYNC_STATUS.SYNCING,
      sync: { ...r.sync, attempts: r.sync.attempts + 1, lastAttemptAt: now(), nextAttemptAt: null },
    }));

    let session;
    try {
      session = await api.syncIncident(buildSyncPayload(syncing, extras));
    } catch (err) {
      const c = classifySyncError(err);
      if (c.outcome === 'RECEIVED') {
        return { record: await markReceived(id, { incidentId: c.incidentId, receivedAt: null, deviceActivatedAt: null }), session: null };
      }
      if (c.outcome === 'STOP') {
        return { record: await fail(id, c.reason), session: null };
      }
      const attempts = syncing.sync.attempts;
      if (attempts >= maxAutoAttempts) {
        return { record: await fail(id, 'RETRY_LIMIT', { ambiguous: c.ambiguous }), session: null };
      }
      const saved = await update(id, (r) => ({
        ...r,
        status: SYNC_STATUS.WAITING_FOR_NETWORK,
        statusReason: c.reason,
        sync: {
          ...r.sync,
          nextAttemptAt: now() + retryDelay(attempts, retryDelays),
          ambiguous: r.sync.ambiguous || c.ambiguous,
          lastError: c.reason,
        },
      }));
      return { record: saved, session: null };
    }

    if (!session?.sessionId) {
      // A success response without an ID cannot be trusted as confirmation, but the server may have stored it.
      const saved = await update(id, (r) => ({
        ...r,
        status: SYNC_STATUS.WAITING_FOR_NETWORK,
        statusReason: 'SERVER_UNAVAILABLE',
        sync: { ...r.sync, nextAttemptAt: now() + retryDelay(r.sync.attempts, retryDelays), ambiguous: true },
      }));
      return { record: saved, session: null };
    }

    const saved = await markReceived(id, {
      incidentId: session.sessionId,
      receivedAt: Number.isFinite(session.activatedAt) ? session.activatedAt : null,
      deviceActivatedAt: Number.isFinite(session.deviceActivatedAt) ? session.deviceActivatedAt : null,
    });
    // The session (disarm token, tracking link) is returned in memory only and never written to storage.
    return { record: saved, session };
  }

  function syncIncident(id) {
    if (inFlight.has(id)) return inFlight.get(id);
    const run = attempt(id).finally(() => inFlight.delete(id));
    inFlight.set(id, run);
    return run;
  }

  function isDue(record, auth) {
    if (inFlight.has(record.id)) return false;
    switch (record.status) {
      case SYNC_STATUS.LOCAL_ONLY:
        return true;
      case SYNC_STATUS.WAITING_FOR_NETWORK:
        return record.sync.nextAttemptAt == null || record.sync.nextAttemptAt <= now();
      case SYNC_STATUS.SYNC_FAILED:
        return record.statusReason === 'AUTH_REQUIRED' && auth.signedIn;
      default:
        return false;
    }
  }

  return {
    syncIncident,

    /** A send interrupted by a crash or kill has an unknown outcome; retrying it is safe because of idempotency. */
    async recoverInterrupted() {
      const records = await repo.list();
      for (const r of records) {
        if (r.status === SYNC_STATUS.SYNCING && !inFlight.has(r.id)) {
          await update(r.id, (cur) => ({
            ...cur,
            status: SYNC_STATUS.WAITING_FOR_NETWORK,
            statusReason: 'INTERRUPTED',
            sync: { ...cur.sync, nextAttemptAt: now(), ambiguous: true },
          }));
        }
      }
    },

    /** Runs every incident that is due, one at a time. */
    async syncDue() {
      const auth = getAuth();
      const results = [];
      for (const r of await repo.listUnsent()) {
        if (isDue(r, auth)) results.push(await syncIncident(r.id));
      }
      return results;
    },

    async nextDueAt() {
      const times = (await repo.listUnsent())
        .filter((r) => r.status === SYNC_STATUS.WAITING_FOR_NETWORK && r.sync.nextAttemptAt != null)
        .map((r) => r.sync.nextAttemptAt);
      return times.length ? Math.min(...times) : null;
    },

    /** Pulls the server's per-recipient status. Returns null if it could not be loaded. */
    async refreshDeliveries(id) {
      const record = await repo.get(id);
      if (record?.status !== SYNC_STATUS.SERVER_RECEIVED && !(record?.status === SYNC_STATUS.CLOSED && record.server)) {
        return null;
      }
      let status;
      try {
        status = await api.getAlertStatus(record.server.incidentId);
      } catch {
        return null;
      }
      if (!Array.isArray(status?.deliveries)) return null;
      return update(id, (r) => ({ ...r, ledger: mergeServerDeliveries(r.ledger, status.deliveries) }));
    },

    /**
     * Closes the record on this phone only. It never stops a server alert: that requires the server-issued
     * disarm token held in memory by the live session, not anything stored here.
     */
    async closeIncident(id, { reason = 'USER_CLOSED' } = {}) {
      if (inFlight.has(id)) return { ok: false, reason: 'SYNC_IN_PROGRESS' };
      const record = await update(id, (r) =>
        r.status === SYNC_STATUS.CLOSED ? null : { ...r, status: SYNC_STATUS.CLOSED, closedAt: now(), closeReason: reason }
      );
      return { ok: Boolean(record), record };
    },

    recordDeviceSms(id, contacts, composerResult) {
      return update(id, (r) => ({
        ...r,
        ledger: recordDeviceSmsAttempt(r.ledger, contacts, { openedAt: now(), composerResult }),
      }));
    },
  };
}
