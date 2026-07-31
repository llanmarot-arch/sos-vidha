const mockSessions = new Map();

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
    const session = {
      sessionId,
      status: 'MONITORING',
      pinSalt: `mock-salt-${sessionId.slice(0, 8)}`,
      disarmToken: `mock-disarm-${sessionId.slice(0, 8)}`,
      trackingUrl: `http://localhost:3001/track/${sessionId}`,
      publicServerUrl: 'http://localhost:3001',
      socketRoom: sessionId,
      mode: body.mode || 'GEOFENCE',
      createdAt: Date.now(),
    };
    mockSessions.set(sessionId, session);
    return session;
  },

  async disarmSession(body) {
    await delay(250);
    const session = mockSessions.get(body.sessionId);
    if (!session) throw new Error('Session not found');
    session.status = 'DISARMED';
    return { success: true, message: 'Alert cancelled successfully', status: 'DISARMED' };
  },

  async getSession(sessionId) {
    await delay(150);
    const session = mockSessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        status: 'MONITORING',
        location: { latitude: 28.6139, longitude: 77.209, speed: 0, batteryLevel: 0.76 },
      };
    }
    return session;
  },

  async sendWhatsApp(payload) {
    await delay(200);
    console.info('[Mock WhatsApp]', payload.contacts?.length, 'recipients');
    return { success: true, mock: true, dispatched: payload.contacts?.length || 0 };
  },
};
