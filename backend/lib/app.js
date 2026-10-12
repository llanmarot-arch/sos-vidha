const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { SessionStore } = require('./sessionStore');
const { renderTrackingDashboard, mapDisplayStatus } = require('./trackingDashboard');
const { generateDisarmToken, secureCompare, resolveSessionPins, pinTypeForDisarm } = require('./pinAuth');
const { createSecretBox } = require('./secretBox');
const { recoverActiveIncidents } = require('./incidentRecovery');
const { createAuthMiddleware } = require('./authMiddleware');
const {
  userOwnsSession,
  authorizeOwnerSocket,
  authorizeTrackerSocket,
  authorizeSessionRead,
} = require('./trackingSecurity');
const {
  validateLocationInput,
  normalizeDeviceLocationError,
  assessLocation,
  normalizeSafetyZone,
  assessSafetyZone,
} = require('./location');
const { buildEmergencySms, buildVoiceTwiml } = require('./smsTemplate');
const { createAlertDispatcher } = require('./alertDispatcher');
const { sha256, buildTrackingUrl, maskPhone } = require('./twilioService');
const { createRateLimiter } = require('./rateLimiter');

const HOUR_MS = 60 * 60 * 1000;
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;
const CLIENT_REQUEST_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const REASON_RE = /^[A-Z_]{1,40}$/;
const DEVICE_CLOCK_MAX_AHEAD_MS = 2 * 60 * 1000;
const DEVICE_ACTIVATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Phone-recorded SOS time, kept only when plausible against the server clock; never used as server time. */
function parseDeviceActivatedAt(value, serverNowMs) {
  if (value == null || value === '') return null;
  const t = Number(value);
  if (!Number.isFinite(t)) return null;
  if (t > serverNowMs + DEVICE_CLOCK_MAX_AHEAD_MS || t < serverNowMs - DEVICE_ACTIVATION_MAX_AGE_MS) return null;
  return Math.round(t);
}

const ownerRoom = (id) => `owner:${id}`;
const trackerRoom = (id) => `tracker:${id}`;

function buildCorsOrigin(config) {
  const allowed = Array.isArray(config.corsOrigins) ? config.corsOrigins : [];
  if (!config.isProduction && allowed.length === 0) return '*';
  return function origin(requestOrigin, callback) {
    if (!requestOrigin || allowed.includes(requestOrigin)) callback(null, true);
    else callback(null, false);
  };
}

function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
}

function publicDelivery(d) {
  return {
    id: d.id,
    channel: d.channel,
    recipientName: d.recipientName,
    to: maskPhone(d.toPhone),
    status: d.status,
    attempts: d.attempts,
    providerMessageId: d.providerMessageSid || null,
    providerErrorCode: d.providerErrorCode,
    acceptedAt: d.acceptedAt,
    sentAt: d.sentAt,
    deliveredAt: d.deliveredAt,
    failedAt: d.failedAt,
    updatedAt: d.updatedAt,
  };
}

function createSosServer({
  config,
  accounts,
  incidents,
  provider = null,
  geocoder = null,
  publicServerUrl,
  now = Date.now,
  sleep,
  logger = console,
}) {
  const secureMode = config.secureMode;
  const callAdvice = `If you are in danger, call ${config.emergencyNumber} now.`;

  const app = express();
  if (config.trustProxy) {
    const tp = String(config.trustProxy);
    app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp);
  }
  const server = http.createServer(app);
  const corsOrigin = buildCorsOrigin(config);
  const secretBox = config.dataEncryptionKey ? createSecretBox(config.dataEncryptionKey) : null;
  const io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  const sessionStore = new SessionStore({ now });
  const heartbeatLostHandled = new Set();
  const pending = new Set();
  const timers = [];

  const statusCallbackUrl = String(publicServerUrl).startsWith('https://')
    ? `${publicServerUrl}/api/twilio/status`
    : null;

  const { attachAuthUser, requireAuthWhenConfigured } = createAuthMiddleware({
    verifyToken: accounts.verifyAccessToken,
    supabaseConfigured: config.supabaseConfigured,
    secureMode,
  });

  const dispatcher = createAlertDispatcher({
    repo: incidents,
    provider,
    liveSend: config.alertsLiveSend,
    maxAttempts: config.smsMaxAttempts,
    retryBaseMs: config.smsRetryBaseMs,
    leaseMs: config.dispatchLeaseMs,
    now,
    sleep,
    logger,
    onUpdate: (delivery) => {
      if (!delivery) return;
      io.to(ownerRoom(delivery.incidentId)).emit('ALERT_STATUS', {
        sessionId: delivery.incidentId,
        delivery: publicDelivery(delivery),
      });
    },
  });

  function track(promise) {
    pending.add(promise);
    promise.finally(() => pending.delete(promise)).catch(() => {});
    return promise;
  }

  function assess(session, referenceTimeMs) {
    return assessLocation(session.location, {
      referenceTimeMs,
      staleAfterMs: config.locationStaleAfterMs,
      maxAccuracyM: config.locationMaxAccuracyM,
      unavailableReason: session.locationUnavailableReason,
    });
  }

  function locationSummary(session) {
    const a = assess(session, session.emergencyTriggeredAt || now());
    return {
      status: a.status,
      reason: a.reason,
      capturedAt: a.location?.timestamp ?? null,
      accuracyM: a.location?.accuracy ?? null,
    };
  }

  function trackingUrlFor(session) {
    return session.trackerToken ? buildTrackingUrl(publicServerUrl, session.sessionId, session.trackerToken) : null;
  }

  function isOwner(session, user) {
    return userOwnsSession(session, user?.id, secureMode);
  }

  function sessionResponse(session, extra = {}) {
    return {
      sessionId: session.sessionId,
      incidentId: session.sessionId,
      status: session.status,
      displayStatus: mapDisplayStatus(session.status),
      pinSalt: session.pinSalt,
      disarmToken: session.disarmToken,
      trackingUrl: trackingUrlFor(session),
      trackerExpiresAt: session.trackerExpiresAt,
      socketRoom: session.sessionId,
      activatedAt: session.emergencyTriggeredAt,
      deviceActivatedAt: session.deviceActivatedAt ?? null,
      publicServerUrl,
      location: locationSummary(session),
      alerts: {
        mode: config.alertsLiveSend ? 'live' : 'dry_run',
        recipientCount: session.recipients.length,
        recipientsOmitted: session.recipientsOmitted || 0,
      },
      ...extra,
    };
  }

  function publicLocation(loc) {
    if (!loc) return null;
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      heading: loc.heading,
      batteryLevel: loc.batteryLevel,
      timestamp: loc.timestamp,
    };
  }

  function broadcastSessionUpdate(session) {
    const rooms = [ownerRoom(session.sessionId), trackerRoom(session.sessionId)];
    io.to(rooms).emit('LOCATION_UPDATE', {
      sessionId: session.sessionId,
      location: publicLocation(session.location),
      status: session.status,
    });
    io.to(rooms).emit('SESSION_STATUS', {
      sessionId: session.sessionId,
      status: session.status,
      displayStatus: mapDisplayStatus(session.status),
    });
  }

  function endTracking(sessionId) {
    io.to(trackerRoom(sessionId)).emit('TRACKING_ENDED', { sessionId });
    io.in(trackerRoom(sessionId)).disconnectSockets(true);
  }

  async function buildAlertContent(session) {
    const activatedAtMs = session.emergencyTriggeredAt;
    const assessment = assess(session, activatedAtMs);
    const safetyZone = assessSafetyZone(session.safeZone, assessment);
    let address = null;
    if (geocoder && assessment.location) {
      address = await geocoder
        .reverse(assessment.location.latitude, assessment.location.longitude)
        .catch(() => null);
    }
    const deviceActivatedAtMs = session.deviceActivatedAt ?? null;
    const body = buildEmergencySms({
      profileName: session.profileName,
      activatedAtMs,
      deviceActivatedAtMs,
      assessment,
      address,
      safetyZone,
      trackingUrl: trackingUrlFor(session),
      trackerExpiresAtMs: session.trackerExpiresAt,
      timeZone: config.smsTimeZone,
      emergencyNumber: config.emergencyNumber,
    });
    const twiml = buildVoiceTwiml({
      profileName: session.profileName,
      activatedAtMs,
      deviceActivatedAtMs,
      timeZone: config.smsTimeZone,
      emergencyNumber: config.emergencyNumber,
    });
    return { body, twiml };
  }

  function isAlertable(session) {
    return Boolean(session && session.status !== 'DISARMED' && session.trackerToken && session.emergencyTriggeredAt);
  }

  async function runAlertDispatch(sessionId) {
    let session = sessionStore.get(sessionId);
    if (!isAlertable(session)) return;

    const { body, twiml } = await buildAlertContent(session);
    session = sessionStore.get(sessionId);
    if (!isAlertable(session)) return;

    let rateLimited = false;
    if (session.userId) {
      try {
        const recent = await incidents.countEmergencyIncidentsSince(
          session.userId,
          session.emergencyTriggeredAt - HOUR_MS,
          sessionId
        );
        rateLimited = recent >= config.smsMaxIncidentsPerHour;
      } catch {
        logger.warn(`[Alerts] Rate-limit check failed for ${sessionId}; continuing with dispatch`);
      }
    }

    const incident = { id: sessionId, userId: session.userId };
    await dispatcher.dispatch({
      incident,
      recipients: session.recipients,
      channel: 'sms',
      body,
      statusCallback: statusCallbackUrl,
      rateLimited,
    });
    if (config.voiceEnabled) {
      await dispatcher.dispatch({ incident, recipients: session.recipients, channel: 'voice', twiml, rateLimited });
    }
  }

  function startAlertDispatch(sessionId) {
    return track(
      runAlertDispatch(sessionId).catch((err) => {
        logger.error(`[Alerts] Dispatch failed for incident ${sessionId}: ${err.message}`);
      })
    );
  }

  async function handleEmergencyTrigger(sessionId, meta = {}) {
    const updated = sessionStore.triggerEmergency(sessionId, meta);
    if (!updated) return null;

    try {
      await incidents.updateIncident(sessionId, {
        status: updated.status,
        emergencyAt: updated.emergencyTriggeredAt,
      });
    } catch (err) {
      logger.error(`[Incident] Status update failed for ${sessionId}: ${err.message}`);
    }

    broadcastSessionUpdate(updated);
    io.to(ownerRoom(sessionId)).emit('EMERGENCY_ACK', {
      sessionId,
      status: updated.status,
      activatedAt: updated.emergencyTriggeredAt,
    });
    startAlertDispatch(sessionId);
    return updated;
  }

  async function revokeTracking(sessionId) {
    endTracking(sessionId);
    try {
      await incidents.updateIncident(sessionId, { trackerRevokedAt: now() });
    } catch (err) {
      logger.error(`[Incident] Tracker revocation persist failed for ${sessionId}: ${err.message}`);
    }
  }

  const startIpLimiter = createRateLimiter({
    windowMs: config.sessionStartWindowMs,
    max: config.sessionStartMaxPerIp,
    keyFn: (req) => req.ip,
    message: `Too many SOS requests from this network. ${callAdvice}`,
    now,
  });
  const startUserLimiter = createRateLimiter({
    windowMs: config.sessionStartWindowMs,
    max: config.sessionStartMaxPerUser,
    keyFn: (req) => req.user?.id || null,
    message: `Too many SOS requests from this account. ${callAdvice}`,
    now,
  });

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(attachAuthUser);

  app.get('/', (_req, res) => {
    res.send('<h1>SOS-Vidha Backend API is Active</h1><p>Status: Healthy</p>');
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  function limitSessionStart(req, res, next) {
    // Authenticated SOS is limited per account. An IP bucket is only used for local
    // development, where there is no account, so anonymous traffic cannot exhaust it.
    if (secureMode) return startUserLimiter(req, res, next);
    return startIpLimiter(req, res, () => startUserLimiter(req, res, next));
  }

  function restorePersistedSession(incident) {
    if (!incident || incident.status === 'DISARMED' || incident.endedAt || incident.trackerRevokedAt) return null;
    if (incident.trackerExpiresAt != null && incident.trackerExpiresAt <= now()) return null;
    const existing = sessionStore.get(incident.id);
    if (existing) return existing.status === 'DISARMED' ? null : existing;
    if (!secretBox || !incident.runtimeEnc) return null;
    let runtime;
    try {
      runtime = JSON.parse(secretBox.decrypt(incident.runtimeEnc));
    } catch {
      logger.error(`[Recovery] Could not read incident ${incident.id}`);
      return null;
    }
    if (!runtime?.trackerToken || !runtime.disarmToken) return null;
    if (incident.trackerTokenSha256 && sha256(runtime.trackerToken) !== incident.trackerTokenSha256) {
      logger.error(`[Recovery] Tracker capability did not match incident ${incident.id}`);
      return null;
    }
    return sessionStore.restore({
      sessionId: incident.id,
      userId: incident.userId,
      mode: incident.mode || 'GEOFENCE',
      status: incident.status,
      initialLocation: incident.location || null,
      locationUnavailableReason: incident.locationUnavailableReason,
      pinSalt: runtime.pinSalt,
      standardPinHash: runtime.standardPinHash,
      duressPinHash: runtime.duressPinHash,
      disarmToken: runtime.disarmToken,
      trackerToken: runtime.trackerToken,
      trackerExpiresAt: incident.trackerExpiresAt,
      profileName: runtime.profileName || null,
      safeZone: incident.safeZone || null,
      recipients: Array.isArray(runtime.recipients) ? runtime.recipients : [],
      deviceActivatedAt: incident.deviceActivatedAt || runtime.deviceActivatedAt || null,
      emergencyTriggeredAt: incident.emergencyAt,
      createdAt: incident.createdAt || incident.activatedAt,
    });
  }

  async function quarantineDeliveries(incidentId) {
    let rows = [];
    try {
      rows = await incidents.listDeliveries(incidentId);
    } catch (err) {
      logger.error(`[Recovery] Could not list deliveries for ${incidentId}`);
      return 0;
    }
    let changed = 0;
    for (const row of rows) {
      if (!['pending', 'sending', 'retrying'].includes(row.status) || row.providerMessageSid) continue;
      await incidents.updateDelivery(row.id, { status: 'unconfirmed', providerErrorCode: 'RECOVERY_UNAVAILABLE' });
      changed += 1;
    }
    return changed;
  }

  app.post('/api/session/start', requireAuthWhenConfigured, limitSessionStart, async (req, res) => {
    const body = req.body || {};
    const userId = req.user?.id || null;
    const mode = body.mode || 'GEOFENCE';

    if (!['GEOFENCE', 'TRANSIT'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be GEOFENCE or TRANSIT' });
    }
    const pins = resolveSessionPins(body);
    delete body.standardPin;
    delete body.duressPin;
    delete body.pin;
    if (pins.error) {
      return res.status(400).json({ error: pins.error });
    }
    if (mode === 'TRANSIT') {
      if (body.destination?.latitude == null || body.destination?.longitude == null) {
        return res.status(400).json({ error: 'destination coordinates are required for TRANSIT mode' });
      }
      if (!Array.isArray(body.routes) || body.routes.length === 0) {
        return res.status(400).json({ error: 'At least one route polyline is required for TRANSIT mode' });
      }
    }

    const clientRequestId =
      typeof body.clientRequestId === 'string' && CLIENT_REQUEST_ID_RE.test(body.clientRequestId)
        ? body.clientRequestId
        : null;

    let recipients = [];
    let profile = { fullName: null, safeZone: null };
    if (config.supabaseConfigured) {
      let contacts;
      try {
        contacts = await accounts.getEmergencyContacts(userId);
      } catch {
        return res.status(503).json({
          error: `Your emergency contacts could not be loaded, so no alert was sent. ${callAdvice}`,
          code: 'CONTACTS_UNAVAILABLE',
        });
      }
      try {
        profile = await accounts.getAlertProfile(userId);
      } catch {
        profile = { fullName: null, safeZone: null };
      }
      recipients = (contacts || [])
        .filter((c) => PHONE_RE.test(String(c.phone_e164)))
        .map((c) => ({ contactId: c.id, name: c.name || null, phone: String(c.phone_e164) }));
    } else {
      recipients = [body.contact1, body.contact2]
        .filter((p) => PHONE_RE.test(String(p || '')))
        .map((p) => ({ contactId: null, name: null, phone: String(p) }));
    }

    const seenPhones = new Set();
    recipients = recipients.filter((r) => (seenPhones.has(r.phone) ? false : seenPhones.add(r.phone)));
    if (recipients.length === 0) {
      return res.status(422).json({
        error: `You have no valid emergency contacts saved, so no alert can be sent. ${callAdvice}`,
        code: 'NO_CONTACTS',
      });
    }
    const recipientsOmitted = Math.max(0, recipients.length - config.smsMaxRecipients);
    recipients = recipients.slice(0, config.smsMaxRecipients);

    const activatedAt = now();
    const deviceActivatedAt = parseDeviceActivatedAt(body.deviceActivatedAt, activatedAt);
    const emergency = body.emergency === true;
    const locationCheck = validateLocationInput(body.location ?? body.initialLocation, activatedAt);
    const initialLocation = locationCheck.ok ? locationCheck.location : null;
    const locationUnavailableReason = locationCheck.ok
      ? null
      : normalizeDeviceLocationError(body.locationError) || locationCheck.reason;
    const assessment = assessLocation(initialLocation, {
      referenceTimeMs: activatedAt,
      staleAfterMs: config.locationStaleAfterMs,
      maxAccuracyM: config.locationMaxAccuracyM,
      unavailableReason: locationUnavailableReason,
    });
    const safeZone = normalizeSafetyZone(profile?.safeZone);
    const zone = assessSafetyZone(safeZone, assessment);

    const sessionId = crypto.randomUUID();
    const trackerToken = generateDisarmToken();
    const disarmToken = generateDisarmToken();
    const trackerExpiresAt = activatedAt + config.trackerTtlMs;
    const runtimeEnc = secretBox
      ? secretBox.encrypt(
          JSON.stringify({
            trackerToken,
            disarmToken,
            pinSalt: pins.pinSalt,
            standardPinHash: pins.standardPinHash,
            duressPinHash: pins.duressPinHash,
            recipients,
            profileName: profile?.fullName || null,
            deviceActivatedAt,
          })
        )
      : null;

    let created;
    try {
      created = await incidents.createIncident({
        id: sessionId,
        userId,
        clientRequestId,
        status: emergency ? 'EMERGENCY' : 'ACTIVE',
        mode,
        activatedAt,
        deviceActivatedAt,
        emergencyAt: emergency ? activatedAt : null,
        location: initialLocation,
        locationStatus: assessment.status,
        locationUnavailableReason,
        safeZone,
        distanceFromSafeZoneM: zone.distanceM,
        trackerTokenSha256: sha256(trackerToken),
        trackerExpiresAt,
        runtimeEnc,
      });
    } catch (err) {
      logger.error(`[Incident] Persist failed: ${err.message}`);
      return res.status(503).json({
        error: `Your SOS could not be recorded on the server, so no alert was sent. ${callAdvice}`,
        code: 'INCIDENT_NOT_PERSISTED',
      });
    }

    if (!created.created) {
      const existing = restorePersistedSession(created.incident);
      if (existing && existing.userId === userId && existing.status !== 'DISARMED') {
        let prior = null;
        try {
          prior = await incidents.listDeliveries(existing.sessionId);
        } catch {
          prior = null;
        }
        return res.status(200).json(
          sessionResponse(existing, {
            reused: true,
            deliveries: prior ? prior.map(publicDelivery) : null,
          })
        );
      }
      let priorDeliveries = null;
      try {
        priorDeliveries = await incidents.listDeliveries(created.incident.id);
      } catch {
        priorDeliveries = null;
      }
      return res.status(409).json({
        error:
          'This SOS was already recorded, but its live session is no longer active. Start a new SOS if you still need help.',
        code: 'INCIDENT_EXISTS',
        incidentId: created.incident.id,
        deliveries: priorDeliveries ? priorDeliveries.map(publicDelivery) : null,
      });
    }

    const session = sessionStore.create({
      sessionId,
      userId,
      mode,
      geofence: body.geofence,
      destination: body.destination,
      routes: body.routes,
      initialLocation,
      locationUnavailableReason,
      pinSalt: pins.pinSalt,
      standardPinHash: pins.standardPinHash,
      duressPinHash: pins.duressPinHash,
      disarmToken,
      trackerToken,
      trackerExpiresAt,
      profileName: profile?.fullName || null,
      safeZone,
      recipients,
    });
    session.recipientsOmitted = recipientsOmitted;
    session.deviceActivatedAt = deviceActivatedAt;
    heartbeatLostHandled.delete(sessionId);

    if (emergency) {
      sessionStore.triggerEmergency(sessionId, { reason: 'SOS_ACTIVATED', at: activatedAt });
      startAlertDispatch(sessionId);
    }

    return res.status(201).json(sessionResponse(session));
  });

  app.get('/api/session/:sessionId/alerts', noStore, requireAuthWhenConfigured, async (req, res) => {
    const { sessionId } = req.params;
    const session = sessionStore.get(sessionId);
    let incident = null;
    try {
      incident = await incidents.getIncident(sessionId);
    } catch {
      return res.status(503).json({ error: 'Alert status is temporarily unavailable.' });
    }
    const ownedViaSession = session && isOwner(session, req.user);
    const ownedViaIncident = incident && (secureMode ? incident.userId && incident.userId === req.user?.id : true);
    if (!ownedViaSession && !ownedViaIncident) {
      return res.status(404).json({ error: 'Session not found' });
    }
    let deliveries = [];
    try {
      deliveries = await incidents.listDeliveries(sessionId);
    } catch {
      return res.status(503).json({ error: 'Alert status is temporarily unavailable.' });
    }
    return res.json({
      sessionId,
      alertsMode: config.alertsLiveSend ? 'live' : 'dry_run',
      status: session?.status || incident?.status,
      location: session
        ? locationSummary(session)
        : { status: incident.locationStatus, reason: incident.locationUnavailableReason },
      deliveries: deliveries.map(publicDelivery),
    });
  });

  app.get('/api/session/:sessionId', noStore, (req, res) => {
    const session = sessionStore.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const readAuth = authorizeSessionRead(session, {
      user: req.user,
      trackerToken: req.query.t,
      secureMode,
      nowMs: now(),
    });
    if (!readAuth.allowed) {
      return res.status(403).json({ error: 'Not authorized to view this session' });
    }

    const payload = {
      sessionId: session.sessionId,
      status: session.status,
      displayStatus: mapDisplayStatus(session.status),
      mode: session.mode,
      location: publicLocation(session.location),
      locationAssessment: locationSummary(session),
      lastLocationUpdate: session.lastLocationUpdate,
      emergencyTriggeredAt: session.emergencyTriggeredAt,
    };
    if (readAuth.mode !== 'tracker') {
      payload.trackingUrl = trackingUrlFor(session);
      payload.trackerExpiresAt = session.trackerExpiresAt;
    }
    return res.json(payload);
  });

  app.get('/track/:sessionId', noStore, (req, res) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    const session = sessionStore.get(req.params.sessionId);
    if (!session) {
      return res.status(404).send('<h1 style="font-family:sans-serif;color:#EF4444">Session not found</h1>');
    }
    const readAuth = authorizeSessionRead(session, {
      user: req.user,
      trackerToken: req.query.t,
      secureMode,
      nowMs: now(),
    });
    if (!readAuth.allowed) {
      return res
        .status(403)
        .send('<h1 style="font-family:sans-serif;color:#EF4444">Tracking link invalid or expired</h1>');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Map tile hosts require a Referer; send only the origin so the capability in the URL never leaks.
    res.setHeader('Referrer-Policy', 'strict-origin');
    return res.send(
      renderTrackingDashboard(session.sessionId, session, {
        publicUrl: publicServerUrl,
        trackerToken: readAuth.mode === 'tracker' ? String(req.query.t) : session.trackerToken,
        secureTracking: secureMode,
        staleAfterMs: config.locationStaleAfterMs,
      })
    );
  });

  app.post('/api/notify/whatsapp', requireAuthWhenConfigured, async (req, res) => {
    const { sessionId } = req.body || {};
    const session = sessionId ? sessionStore.get(sessionId) : null;
    if (!session || !isOwner(session, req.user)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!isAlertable(session)) {
      return res.status(409).json({ error: 'WhatsApp alerts can only be sent for an active SOS.' });
    }
    if (config.alertsLiveSend && !config.twilio.whatsappFrom) {
      return res.status(503).json({ error: 'WhatsApp sending is not configured on the server.' });
    }
    try {
      const { body } = await buildAlertContent(session);
      const deliveries = await dispatcher.dispatch({
        incident: { id: session.sessionId, userId: session.userId },
        recipients: session.recipients,
        channel: 'whatsapp',
        body,
        statusCallback: statusCallbackUrl,
      });
      return res.json({ deliveries: deliveries.map(publicDelivery) });
    } catch (err) {
      logger.error(`[Alerts] WhatsApp dispatch failed for ${session.sessionId}: ${err.message}`);
      return res.status(503).json({ error: 'WhatsApp alerts could not be processed.' });
    }
  });

  app.post('/api/twilio/status', express.urlencoded({ extended: false }), async (req, res) => {
    if (!provider || !statusCallbackUrl) {
      return res.status(404).end();
    }
    const valid = provider.validateWebhook({
      signature: req.get('x-twilio-signature'),
      url: statusCallbackUrl,
      params: req.body || {},
    });
    if (!valid) {
      return res.status(403).end();
    }
    const { MessageSid, MessageStatus, ErrorCode } = req.body || {};
    if (MessageSid && MessageStatus) {
      try {
        await dispatcher.applyStatusCallback({ sid: MessageSid, providerStatus: MessageStatus, errorCode: ErrorCode });
      } catch (err) {
        logger.error(`[Alerts] Status callback failed: ${err.message}`);
        return res.status(500).end();
      }
    }
    return res.status(204).end();
  });

  const disarmLimiter = createRateLimiter({
    windowMs: config.disarmWindowMs,
    max: config.disarmMaxAttempts,
    keyFn: (req) => {
      const sessionId = req.body?.sessionId;
      if (!sessionId) return null;
      return `${req.user?.id || req.ip || 'anon'}:${sessionId}`;
    },
    message: 'Too many disarm attempts. The SOS stays active. Wait and try again, or call emergency services.',
    now,
  });

  app.post('/api/session/disarm', requireAuthWhenConfigured, disarmLimiter, async (req, res) => {
    const { sessionId, pinHash, pin, disarmToken, method } = req.body || {};
    if (req.body) delete req.body.pin;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (secureMode && !isOwner(session, req.user)) {
      return res.status(403).json({ error: 'Not authorized for this session', success: false });
    }

    let pinType = null;
    if (method === 'BIOMETRIC' && disarmToken && session.disarmToken) {
      if (!secureCompare(disarmToken, session.disarmToken)) {
        return res.status(401).json({ error: 'Invalid disarm token', success: false });
      }
      pinType = 'STANDARD';
    } else if (pin || pinHash) {
      pinType = pinTypeForDisarm({
        pin,
        pinHash,
        pinSalt: session.pinSalt,
        standardPinHash: session.standardPinHash,
        duressPinHash: session.duressPinHash,
      });
      if (!pinType) {
        return res.status(401).json({ error: 'Invalid PIN', success: false });
      }
    } else {
      return res.status(400).json({ error: 'PIN or biometric disarmToken required', success: false });
    }

    if (pinType === 'DURESS') {
      sessionStore.activateDuress(sessionId);
      await handleEmergencyTrigger(sessionId, { reason: 'DURESS_PIN', duress: true });
      return res.json({ success: true, message: 'Alert cancelled successfully', status: 'DISARMED' });
    }

    const updated = sessionStore.disarmStandard(sessionId);
    broadcastSessionUpdate(updated);
    try {
      await incidents.updateIncident(sessionId, {
        status: 'DISARMED',
        endedAt: updated.disarmedAt,
        trackerRevokedAt: updated.disarmedAt,
      });
    } catch (err) {
      logger.error(`[Incident] Disarm persist failed for ${sessionId}: ${err.message}`);
    }
    endTracking(sessionId);

    return res.json({ success: true, message: 'Alert cancelled successfully', status: 'DISARMED' });
  });

  app.use((err, _req, res, _next) => {
    logger.error(`[HTTP] ${err.type || err.name || 'Error'}`);
    const status = err.status && err.status < 500 ? err.status : 500;
    res.status(status).json({ error: status === 500 ? 'Internal error' : 'Invalid request' });
  });

  io.use(async (socket, next) => {
    socket.data.user = null;
    const token = socket.handshake.auth?.token;
    if (token && config.supabaseConfigured) {
      try {
        socket.data.user = await accounts.verifyAccessToken(token);
      } catch {
        socket.data.user = null;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    function reject(message) {
      socket.emit('ERROR', { message, code: 'UNAUTHORIZED' });
    }

    function ownedSession() {
      if (socket.data.role !== 'owner') return null;
      const session = sessionStore.get(socket.data.sessionId);
      const authz = authorizeOwnerSocket(session, socket.data.user, secureMode);
      return authz.allowed ? session : null;
    }

    socket.on('join-room', (payload) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        socket.emit('ERROR', { message: 'sessionId required for join-room' });
        return;
      }
      const session = sessionStore.get(sessionId);
      const authz = authorizeOwnerSocket(session, socket.data.user, secureMode);
      if (!authz.allowed) {
        reject('Not authorized for this session');
        return;
      }
      socket.join(ownerRoom(sessionId));
      sessionStore.addSocket(sessionId, socket.id);
      socket.data.sessionId = sessionId;
      socket.data.role = 'owner';
      socket.emit('ROOM_JOINED', {
        sessionId,
        status: session.status,
        trackingUrl: trackingUrlFor(session),
        trackerExpiresAt: session.trackerExpiresAt,
      });
    });

    socket.on('join-tracker', (payload) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) {
        socket.emit('ERROR', { message: 'sessionId required for join-tracker' });
        return;
      }
      const session = sessionStore.get(sessionId);
      const capability = payload?.trackerToken || socket.handshake.auth?.trackerToken || null;
      const authz = authorizeTrackerSocket(session, capability, secureMode, now());
      if (!authz.allowed) {
        reject('Invalid or expired tracking link');
        return;
      }
      socket.join(trackerRoom(sessionId));
      sessionStore.addTrackerSocket(sessionId, socket.id);
      socket.data.sessionId = sessionId;
      socket.data.role = 'tracker';
      socket.emit('TRACKER_SNAPSHOT', {
        sessionId,
        location: publicLocation(session.location),
        status: session.status,
        displayStatus: mapDisplayStatus(session.status),
      });
    });

    const handleLocationStream = (payload) => {
      const session = ownedSession();
      if (!session) {
        reject('Only the session owner can publish location updates');
        return;
      }
      const check = validateLocationInput(payload, now());
      if (!check.ok) {
        socket.emit('ERROR', { message: 'Invalid location update', code: 'INVALID_LOCATION' });
        return;
      }
      sessionStore.updateLocation(session.sessionId, check.location);
      if (payload.clientStatus) sessionStore.updateClientStatus(session.sessionId, payload.clientStatus);
      const published = sessionStore.get(session.sessionId);
      const assessment = assess(published, published.emergencyTriggeredAt || now());
      incidents
        .updateIncidentLocation(session.sessionId, {
          location: check.location,
          locationStatus: assessment.status,
          locationUnavailableReason: assessment.status === 'UNAVAILABLE' ? assessment.reason : null,
        })
        .catch(() => {
          logger.error(`[Incident] Location persist failed for ${session.sessionId}`);
        });
      broadcastSessionUpdate(published);
    };
    socket.on('location-stream', handleLocationStream);
    socket.on('LOCATION_UPDATE', handleLocationStream);

    socket.on('client-status', (payload) => {
      const session = ownedSession();
      if (!session) {
        reject('Only the session owner can change session status');
        return;
      }
      const updated = sessionStore.updateClientStatus(session.sessionId, payload?.status);
      if (updated) broadcastSessionUpdate(updated);
    });

    socket.on('HEARTBEAT', () => {
      const session = ownedSession();
      if (session) sessionStore.touchHeartbeat(session.sessionId);
    });

    const handleSosTrigger = async (payload) => {
      const session = ownedSession();
      if (!session) {
        reject('Only the session owner can trigger an emergency');
        return;
      }
      const reason = REASON_RE.test(String(payload?.reason || '')) ? payload.reason : 'SOS_TRIGGER';
      await handleEmergencyTrigger(session.sessionId, { reason, duress: Boolean(payload?.duress) });
    };
    socket.on('sos-trigger', handleSosTrigger);
    socket.on('TRIGGER_EMERGENCY', handleSosTrigger);

    socket.on('HEARTBEAT_LOST', async () => {
      const session = ownedSession();
      if (!session || heartbeatLostHandled.has(session.sessionId) || session.status === 'DISARMED') return;
      heartbeatLostHandled.add(session.sessionId);
      await handleEmergencyTrigger(session.sessionId, { reason: 'HEARTBEAT_LOST' });
    });

    socket.on('disconnect', () => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      if (socket.data.role === 'tracker') sessionStore.removeTrackerSocket(sessionId, socket.id);
      else if (socket.data.role === 'owner') sessionStore.removeSocket(sessionId, socket.id);
    });
  });

  function runMaintenance() {
    for (const sessionId of sessionStore.expireTrackerCapabilities()) {
      revokeTracking(sessionId);
    }
    sessionStore.cleanup();
  }

  function checkHeartbeats() {
    for (const { session } of sessionStore.getStaleSessions(config.heartbeatLostThresholdMs)) {
      if (heartbeatLostHandled.has(session.sessionId) || session.socketIds.size > 0) continue;
      heartbeatLostHandled.add(session.sessionId);
      handleEmergencyTrigger(session.sessionId, { reason: 'HEARTBEAT_LOST' }).catch((err) => {
        logger.error(`[Heartbeat] Emergency trigger failed: ${err.message}`);
      });
    }
  }

  function start(port = config.port, host = '0.0.0.0') {
    timers.push(setInterval(checkHeartbeats, config.heartbeatCheckIntervalMs));
    timers.push(setInterval(runMaintenance, Math.min(60000, config.sessionCleanupIntervalMs)));
    return new Promise((resolve) => {
      server.listen(port, host, () => resolve(server.address()));
    });
  }

  async function stop() {
    timers.splice(0).forEach(clearInterval);
    await new Promise((resolve) => io.close(() => resolve()));
    if (server.listening) {
      await new Promise((resolve) => server.close(() => resolve()));
    }
  }

  async function waitForIdle() {
    while (pending.size) {
      await Promise.allSettled([...pending]);
    }
  }

  function recover() {
    return recoverActiveIncidents({
      incidents,
      now,
      restoreSession: (incident) => restorePersistedSession(incident),
      dispatchSession: (sessionId) => runAlertDispatch(sessionId),
      quarantineDeliveries,
    });
  }

  return {
    app,
    server,
    io,
    sessionStore,
    start,
    stop,
    waitForIdle,
    runMaintenance,
    checkHeartbeats,
    recover,
  };
}

module.exports = { createSosServer };
