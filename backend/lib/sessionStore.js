/**
 * In-memory live state for active SOS sessions (sockets, latest location, secrets).
 * The durable incident record lives in the incident repository; session ID == incident ID.
 * Structured for a future Redis adapter migration.
 */
class SessionStore {
  constructor({ now = Date.now } = {}) {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
    this.now = now;
  }

  create(payload) {
    const now = this.now();

    const record = {
      sessionId: payload.sessionId,
      userId: payload.userId || null,
      mode: payload.mode,
      status: 'MONITORING',
      geofence: payload.geofence || null,
      destination: payload.destination || null,
      routes: payload.routes || [],
      pinSalt: payload.pinSalt || null,
      standardPinHash: payload.standardPinHash || null,
      duressPinHash: payload.duressPinHash || null,
      disarmToken: payload.disarmToken || null,
      trackerToken: payload.trackerToken || null,
      trackerExpiresAt: payload.trackerExpiresAt ?? null,
      trackerRevoked: false,
      profileName: payload.profileName || null,
      safeZone: payload.safeZone || null,
      recipients: payload.recipients || [],
      location: payload.initialLocation || null,
      locationUnavailableReason: payload.locationUnavailableReason || null,
      lastHeartbeat: now,
      lastLocationUpdate: payload.initialLocation ? now : null,
      createdAt: now,
      emergencyTriggeredAt: null,
      emergencyReason: null,
      duressActive: false,
      socketIds: new Set(),
      trackerSocketIds: new Set(),
    };

    this.sessions.set(record.sessionId, record);
    return record;
  }

  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /** Expects a location already checked by validateLocationInput. */
  updateLocation(sessionId, location) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.location = { ...location };
    session.locationUnavailableReason = null;
    session.lastLocationUpdate = this.now();
    session.lastHeartbeat = this.now();
    return session;
  }

  /** Clients may only report monitoring states; emergencies go through triggerEmergency. */
  updateClientStatus(sessionId, status) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.status === 'DISARMED' || session.emergencyTriggeredAt) return session;
    if (['MONITORING', 'WARNING'].includes(status)) {
      session.status = status;
    }
    return session;
  }

  touchHeartbeat(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.lastHeartbeat = this.now();
    return session;
  }

  triggerEmergency(sessionId, { reason, duress = false, at = null } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'DISARMED') return null;

    if (session.emergencyTriggeredAt && !duress) {
      return session;
    }

    session.status = duress ? 'DURESS_ACTIVE' : 'EMERGENCY';
    session.duressActive = duress;
    session.emergencyReason = reason || 'UNKNOWN';
    if (!session.emergencyTriggeredAt) {
      session.emergencyTriggeredAt = at ?? this.now();
    }
    return session;
  }

  disarmStandard(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'DISARMED';
    session.duressActive = false;
    session.disarmedAt = this.now();
    session.trackerRevoked = true;
    session.trackerToken = null;
    return session;
  }

  revokeTrackerAccess(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.trackerRevoked = true;
    session.trackerToken = null;
    return session;
  }

  /** Revokes tracker capabilities past their expiry; returns the affected session IDs. */
  expireTrackerCapabilities() {
    const now = this.now();
    const expired = [];
    for (const session of this.sessions.values()) {
      if (!session.trackerRevoked && session.trackerExpiresAt != null && now >= session.trackerExpiresAt) {
        this.revokeTrackerAccess(session.sessionId);
        expired.push(session.sessionId);
      }
    }
    return expired;
  }

  activateDuress(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.duressActive = true;
    session.status = 'DURESS_ACTIVE';
    session.duressActivatedAt = this.now();
    return session;
  }

  addSocket(sessionId, socketId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.socketIds.add(socketId);
    return true;
  }

  removeSocket(sessionId, socketId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.socketIds.delete(socketId);
    return true;
  }

  addTrackerSocket(sessionId, socketId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.trackerSocketIds.add(socketId);
    return true;
  }

  removeTrackerSocket(sessionId, socketId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.trackerSocketIds.delete(socketId);
    return true;
  }

  getStaleSessions(thresholdMs) {
    const now = this.now();
    const stale = [];

    for (const session of this.sessions.values()) {
      if (session.status === 'DISARMED') continue;
      if (session.status === 'EMERGENCY' || session.status === 'DURESS_ACTIVE') continue;

      const elapsed = now - session.lastHeartbeat;
      if (elapsed >= thresholdMs) {
        stale.push({ session, elapsedMs: elapsed });
      }
    }

    return stale;
  }

  cleanup(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = this.now();
    for (const [id, session] of this.sessions.entries()) {
      const terminal =
        session.status === 'DISARMED' ||
        session.status === 'EMERGENCY' ||
        session.status === 'DURESS_ACTIVE';

      if (
        terminal &&
        now - (session.disarmedAt || session.emergencyTriggeredAt || session.createdAt) > maxAgeMs
      ) {
        this.sessions.delete(id);
      }
    }
  }
}

module.exports = { SessionStore };
