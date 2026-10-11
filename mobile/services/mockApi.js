const mockSessions = new Map();

function generateToken() {
  const bytes = new Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function v4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const mockApi = {
  async getHealth() {
    return { ok: true, mock: true };
  },

  async startSession(body) {
    await delay(350);
    const sessionId = v4();
    const disarmToken = generateToken();
    const trackerToken = generateToken();
    const session = {
      sessionId,
      status: 'MONITORING',
      pinSalt: `mock-salt-${sessionId.slice(0, 8)}`,
      disarmToken,
      trackerToken,
      trackingUrl: `http://localhost:3001/track/${sessionId}?t=${encodeURIComponent(trackerToken)}`,
      publicServerUrl: 'http://localhost:3001',
      socketRoom: sessionId,
      mode: body.mode || 'GEOFENCE',
      createdAt: Date.now(),
      activatedAt: Date.now(),
      location: body.location
        ? { status: 'FRESH', reason: null, capturedAt: body.location.timestamp, accuracyM: body.location.accuracy ?? null }
        : { status: 'UNAVAILABLE', reason: body.locationError || 'NOT_PROVIDED', capturedAt: null, accuracyM: null },
      alerts: { mode: 'dry_run', recipientCount: 0, recipientsOmitted: 0 },
      deliveries: [],
    };
    mockSessions.set(sessionId, session);
    return session;
  },

  async disarmSession(body) {
    await delay(250);
    const session = mockSessions.get(body.sessionId);
    if (!session) throw new Error('Session not found');

    if (body.method === 'BIOMETRIC') {
      if (!body.disarmToken || body.disarmToken !== session.disarmToken) {
        throw new Error('Invalid disarm token');
      }
    }

    session.status = 'DISARMED';
    return { success: true, message: 'Alert cancelled successfully', status: 'DISARMED' };
  },

  async getSession(sessionId) {
    await delay(150);
    const session = mockSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session;
  },

  async getAlertStatus(sessionId) {
    await delay(100);
    const session = mockSessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return {
      sessionId,
      alertsMode: 'dry_run',
      status: session.status,
      location: session.location,
      deliveries: session.deliveries,
    };
  },

  async sendWhatsApp() {
    await delay(200);
    return { mock: true, deliveries: [] };
  },
};
