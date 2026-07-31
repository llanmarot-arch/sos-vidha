require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { SessionStore } = require('./lib/sessionStore');
const { createTwilioClient, notifyEmergencyContacts, notifyWhatsAppContacts, buildTrackingUrl } = require('./lib/twilioService');
const { resolvePublicServerUrl } = require('./lib/serverUrl');
const { renderTrackingDashboard, mapDisplayStatus } = require('./lib/trackingDashboard');
const {
  generatePinSalt,
  generateDisarmToken,
  verifyPinHash,
  secureCompare,
} = require('./lib/pinAuth');

const PORT = Number(process.env.PORT) || 3001;
const HEARTBEAT_LOST_THRESHOLD_MS = Number(process.env.HEARTBEAT_LOST_THRESHOLD_MS) || 60000;
const HEARTBEAT_CHECK_INTERVAL_MS = Number(process.env.HEARTBEAT_CHECK_INTERVAL_MS) || 15000;
const SESSION_CLEANUP_INTERVAL_MS = Number(process.env.SESSION_CLEANUP_INTERVAL_MS) || 300000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const sessionStore = new SessionStore();
const twilioBundle = createTwilioClient();

/** @type {Set<string>} */
const heartbeatLostHandled = new Set();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('<h1>SOS-Vidha Backend API is Active</h1><p>Status: Healthy</p><p>Live tracking available at <code>/track/:sessionId</code></p>');
});

function validateContacts(contact1, contact2) {
  const phoneRegex = /^\+?[1-9]\d{7,14}$/;
  if (!phoneRegex.test(String(contact1))) {
    return 'contact1 must be a valid E.164 phone number';
  }
  if (!phoneRegex.test(String(contact2))) {
    return 'contact2 must be a valid E.164 phone number';
  }
  return null;
}

function broadcastSessionUpdate(session) {
  io.to(session.sessionId).emit('LOCATION_UPDATE', {
    sessionId: session.sessionId,
    location: session.location,
    status: session.status,
  });
  io.to(session.sessionId).emit('SESSION_STATUS', {
    sessionId: session.sessionId,
    status: session.status,
    displayStatus: mapDisplayStatus(session.status),
  });
}

async function handleEmergencyTrigger(session, meta = {}) {
  const updated = sessionStore.triggerEmergency(session.sessionId, meta);
  if (!updated) return null;

  const notificationResults = await notifyEmergencyContacts(twilioBundle, updated);
  broadcastSessionUpdate(updated);

  io.to(updated.sessionId).emit('EMERGENCY_ACK', {
    sessionId: updated.sessionId,
    status: updated.status,
    trackingUrl: buildTrackingUrl(updated.sessionId),
    notifiedAt: Date.now(),
    notificationResults,
  });

  return { session: updated, notificationResults };
}

function applyLocationPayload(sessionId, payload) {
  const session = sessionStore.updateLocation(sessionId, payload);
  if (!session) return null;

  if (payload.clientStatus) {
    sessionStore.updateClientStatus(sessionId, payload.clientStatus);
  }

  return sessionStore.get(sessionId);
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    activeSessions: sessionStore.sessions.size,
    publicServerUrl: resolvePublicServerUrl(PORT),
    uptime: process.uptime(),
  });
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = sessionStore.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId: session.sessionId,
    status: session.status,
    displayStatus: mapDisplayStatus(session.status),
    mode: session.mode,
    location: session.location,
    trackingUrl: buildTrackingUrl(session.sessionId),
    lastHeartbeat: session.lastHeartbeat,
    emergencyTriggeredAt: session.emergencyTriggeredAt,
  });
});

app.get('/track/:sessionId', (req, res) => {
  const session = sessionStore.get(req.params.sessionId);
  if (!session) {
    return res.status(404).send('<h1 style="font-family:sans-serif;color:#EF4444">Session not found</h1>');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderTrackingDashboard(req.params.sessionId, session, { port: PORT }));
});

app.post('/api/session/start', (req, res) => {
  const {
    userPhone,
    contact1,
    contact2,
    mode,
    geofence,
    destination,
    routes,
    initialLocation,
    pinSalt,
    standardPinHash,
    duressPinHash,
  } = req.body;

  if (!userPhone || !contact1 || !contact2) {
    return res.status(400).json({ error: 'userPhone, contact1, and contact2 are required' });
  }

  const contactError = validateContacts(contact1, contact2);
  if (contactError) {
    return res.status(400).json({ error: contactError });
  }

  if (!['GEOFENCE', 'TRANSIT'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be GEOFENCE or TRANSIT' });
  }

  if (!standardPinHash || !duressPinHash) {
    return res.status(400).json({ error: 'standardPinHash and duressPinHash are required' });
  }

  if (mode === 'GEOFENCE') {
    if (!geofence?.center?.latitude || !geofence?.center?.longitude || !geofence?.radiusMeters) {
      return res.status(400).json({
        error: 'geofence.center and geofence.radiusMeters are required for GEOFENCE mode',
      });
    }
  }

  if (mode === 'TRANSIT') {
    if (!destination?.latitude || !destination?.longitude) {
      return res.status(400).json({ error: 'destination coordinates are required for TRANSIT mode' });
    }
    if (!Array.isArray(routes) || routes.length === 0) {
      return res.status(400).json({ error: 'At least one route polyline is required for TRANSIT mode' });
    }
  }

  const resolvedSalt = pinSalt || generatePinSalt();
  const disarmToken = generateDisarmToken();

  const session = sessionStore.create({
    userPhone,
    contact1,
    contact2,
    mode,
    geofence,
    destination,
    routes,
    initialLocation,
    pinSalt: resolvedSalt,
    standardPinHash,
    duressPinHash,
    disarmToken,
  });

  heartbeatLostHandled.delete(session.sessionId);

  res.status(201).json({
    sessionId: session.sessionId,
    status: session.status,
    pinSalt: resolvedSalt,
    disarmToken,
    trackingUrl: buildTrackingUrl(session.sessionId),
    publicServerUrl: resolvePublicServerUrl(PORT),
    socketRoom: session.sessionId,
  });
});

app.post('/api/notify/whatsapp', async (req, res) => {
  const { contacts, message, sessionId } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'contacts array is required' });
  }

  const phoneRegex = /^\+?[1-9]\d{7,14}$/;
  const invalid = contacts.find((phone) => !phoneRegex.test(String(phone)));
  if (invalid) {
    return res.status(400).json({ error: `Invalid phone number: ${invalid}` });
  }

  let body = message;
  if (!body && sessionId) {
    const session = sessionStore.get(sessionId);
    if (session) {
      body = [
        'SOS-VIDHA LIVE LOCATION ALERT',
        'Emergency protocol activated. Track my live position:',
        buildTrackingUrl(sessionId),
        'Please respond immediately.',
      ].join('\n');
    }
  }

  if (!body) {
    return res.status(400).json({ error: 'message or valid sessionId is required' });
  }

  const results = await notifyWhatsAppContacts(twilioBundle, contacts, body);
  res.json({ success: true, dispatched: results.length, results });
});

app.post('/api/session/disarm', async (req, res) => {
  const { sessionId, pinHash, disarmToken, method } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  let pinType = null;

  if (method === 'BIOMETRIC' && disarmToken && session.disarmToken) {
    if (!secureCompare(disarmToken, session.disarmToken)) {
      return res.status(401).json({ error: 'Invalid disarm token', success: false });
    }
    pinType = 'STANDARD';
  } else if (pinHash) {
    pinType = verifyPinHash(pinHash, session.standardPinHash, session.duressPinHash);
    if (!pinType) {
      return res.status(401).json({ error: 'Invalid PIN', success: false });
    }
  } else {
    return res.status(400).json({ error: 'pinHash or biometric disarmToken required', success: false });
  }

  if (pinType === 'DURESS') {
    const duressSession = sessionStore.activateDuress(sessionId);
    await handleEmergencyTrigger(duressSession, { reason: 'DURESS_PIN', duress: true });

    return res.json({
      success: true,
      message: 'Alert cancelled successfully',
      status: 'DISARMED',
    });
  }

  const updated = sessionStore.disarmStandard(sessionId);
  broadcastSessionUpdate(updated);

  return res.json({
    success: true,
    message: 'Alert cancelled successfully',
    status: 'DISARMED',
  });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('join-room', ({ sessionId }) => {
    if (!sessionId) {
      socket.emit('ERROR', { message: 'sessionId required for join-room' });
      return;
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      socket.emit('ERROR', { message: 'Invalid sessionId' });
      return;
    }

    socket.join(sessionId);
    sessionStore.addSocket(sessionId, socket.id);
    socket.data.sessionId = sessionId;
    socket.data.role = 'client';

    socket.emit('ROOM_JOINED', {
      sessionId,
      status: session.status,
      trackingUrl: buildTrackingUrl(sessionId),
      publicServerUrl: resolvePublicServerUrl(PORT),
    });
  });

  socket.on('join-tracker', ({ sessionId }) => {
    if (!sessionId) {
      socket.emit('ERROR', { message: 'sessionId required for join-tracker' });
      return;
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      socket.emit('ERROR', { message: 'Invalid sessionId' });
      return;
    }

    socket.join(sessionId);
    sessionStore.addTrackerSocket(sessionId, socket.id);
    socket.data.sessionId = sessionId;
    socket.data.role = 'tracker';

    socket.emit('TRACKER_SNAPSHOT', {
      sessionId,
      location: session.location,
      status: session.status,
      displayStatus: mapDisplayStatus(session.status),
    });
  });

  const handleLocationStream = (payload) => {
    const sessionId = payload?.sessionId || socket.data.sessionId;
    if (!sessionId || payload?.latitude == null || payload?.longitude == null) {
      return;
    }

    const session = applyLocationPayload(sessionId, payload);
    if (!session) return;

    broadcastSessionUpdate(session);
  };

  socket.on('location-stream', handleLocationStream);
  socket.on('LOCATION_UPDATE', handleLocationStream);

  socket.on('client-status', ({ sessionId, status }) => {
    const id = sessionId || socket.data.sessionId;
    if (!id || !status) return;
    const session = sessionStore.updateClientStatus(id, status);
    if (session) broadcastSessionUpdate(session);
  });

  socket.on('HEARTBEAT', ({ sessionId }) => {
    const id = sessionId || socket.data.sessionId;
    if (!id) return;
    sessionStore.touchHeartbeat(id);
  });

  const handleSosTrigger = async (payload) => {
    const sessionId = payload?.sessionId || socket.data.sessionId;
    if (!sessionId) {
      socket.emit('ERROR', { message: 'sessionId required' });
      return;
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      socket.emit('ERROR', { message: 'Invalid sessionId' });
      return;
    }

    await handleEmergencyTrigger(session, {
      reason: payload?.reason || 'SOS_TRIGGER',
      duress: Boolean(payload?.duress),
    });
  };

  socket.on('sos-trigger', handleSosTrigger);
  socket.on('TRIGGER_EMERGENCY', handleSosTrigger);

  socket.on('HEARTBEAT_LOST', async (payload) => {
    const sessionId = payload?.sessionId || socket.data.sessionId;
    if (!sessionId || heartbeatLostHandled.has(sessionId)) return;

    const session = sessionStore.get(sessionId);
    if (!session || session.status === 'DISARMED') return;

    heartbeatLostHandled.add(sessionId);
    await handleEmergencyTrigger(session, { reason: 'HEARTBEAT_LOST' });
  });

  socket.on('disconnect', () => {
    const sessionId = socket.data.sessionId;
    if (sessionId) {
      if (socket.data.role === 'tracker') {
        sessionStore.removeTrackerSocket(sessionId, socket.id);
      } else {
        sessionStore.removeSocket(sessionId, socket.id);
      }
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  const stale = sessionStore.getStaleSessions(HEARTBEAT_LOST_THRESHOLD_MS);

  for (const { session } of stale) {
    if (heartbeatLostHandled.has(session.sessionId)) continue;
    if (session.socketIds.size > 0) continue;

    heartbeatLostHandled.add(session.sessionId);
    handleEmergencyTrigger(session, { reason: 'HEARTBEAT_LOST' }).catch((err) => {
      console.error('[Heartbeat] Emergency trigger failed:', err);
    });
  }
}, HEARTBEAT_CHECK_INTERVAL_MS);

setInterval(() => {
  sessionStore.cleanup();
}, SESSION_CLEANUP_INTERVAL_MS);

server.listen(PORT, '0.0.0.0', () => {
  const publicUrl = resolvePublicServerUrl(PORT);
  console.log(`SOS-Vidha backend listening on 0.0.0.0:${PORT}`);
  console.log(`Public server URL: ${publicUrl}`);
  console.log(`Tracking links: ${publicUrl}/track/<sessionId>`);
});

module.exports = { app, server, io, sessionStore };

