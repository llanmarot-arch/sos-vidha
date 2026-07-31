const { v4: uuidv4 } = require('uuid');

/**
 * In-memory active session tracker with heartbeat health checks.
 * Structured for future Redis adapter migration.
 */
class SessionStore {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
  }

  create(payload) {
    const sessionId = uuidv4();
    const now = Date.now();

    const record = {
      sessionId,
      userPhone: payload.userPhone,
      contact1: payload.contact1,
      contact2: payload.contact2,
      mode: payload.mode,
      status: 'MONITORING',
      geofence: payload.geofence || null,
      destination: payload.destination || null,
      routes: payload.routes || [],
      pinSalt: payload.pinSalt || null,
      standardPinHash: payload.standardPinHash || null,
      duressPinHash: payload.duressPinHash || null,
      disarmToken: payload.disarmToken || null,
      location: payload.initialLocation || null,
      lastHeartbeat: now,
      lastLocationUpdate: now,
      createdAt: now,
      emergencyTriggeredAt: null,
      duressActive: false,
      socketIds: new Set(),
      trackerSocketIds: new Set(),
    };

    this.sessions.set(sessionId, record);
    return record;
  }

  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  updateLocation(sessionId, location) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed ?? null,
      heading: location.heading ?? null,
      accuracy: location.accuracy ?? null,
      batteryLevel: location.batteryLevel ?? null,
      timestamp: location.timestamp || Date.now(),
    };
    session.lastLocationUpdate = Date.now();
    session.lastHeartbeat = Date.now();
    return session;
  }

  updateClientStatus(sessionId, status) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (['MONITORING', 'WARNING', 'EMERGENCY', 'DURESS_ACTIVE'].includes(status)) {
      session.status = status;
    }
    return session;
  }

  touchHeartbeat(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.lastHeartbeat = Date.now();
    return session;
  }

  triggerEmergency(sessionId, { reason, duress = false } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if ((session.status === 'EMERGENCY' || session.status === 'DURESS_ACTIVE') && !duress) {
      return session;
    }

    session.status = duress ? 'DURESS_ACTIVE' : 'EMERGENCY';
    session.duressActive = duress;
    session.emergencyReason = reason || 'UNKNOWN';
    session.emergencyTriggeredAt = Date.now();
    return session;
  }

  disarmStandard(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'DISARMED';
    session.duressActive = false;
    session.disarmedAt = Date.now();
    return session;
  }

  activateDuress(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.duressActive = true;
    session.status = 'DURESS_ACTIVE';
    session.duressActivatedAt = Date.now();
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
    const now = Date.now();
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
    const now = Date.now();
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
