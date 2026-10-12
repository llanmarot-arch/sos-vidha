const { secureCompare } = require('./pinAuth');

function isSecureTrackingEnabled(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return true;
  }
  return env.NODE_ENV === 'production';
}

function isTrackerCapabilityValid(session, trackerToken, nowMs = Date.now()) {
  if (!session || !trackerToken || !session.trackerToken) {
    return false;
  }
  if (session.status === 'DISARMED') {
    return false;
  }
  if (session.trackerRevoked) {
    return false;
  }
  if (session.trackerExpiresAt != null && nowMs >= session.trackerExpiresAt) {
    return false;
  }
  return secureCompare(String(trackerToken), String(session.trackerToken));
}

function userOwnsSession(session, userId, secureMode = isSecureTrackingEnabled()) {
  if (!session) {
    return false;
  }
  if (secureMode) {
    if (!session.userId || !userId) {
      return false;
    }
    return session.userId === userId;
  }
  if (!session.userId) {
    return true;
  }
  if (!userId) {
    return false;
  }
  return session.userId === userId;
}

function authorizeOwnerSocket(session, user, secureMode = isSecureTrackingEnabled()) {
  if (!session) {
    return { allowed: false, reason: 'INVALID_SESSION' };
  }
  if (secureMode && !user?.id) {
    return { allowed: false, reason: 'AUTH_REQUIRED' };
  }
  if (!userOwnsSession(session, user?.id, secureMode)) {
    return { allowed: false, reason: 'FORBIDDEN' };
  }
  return { allowed: true, role: 'owner' };
}

function authorizeTrackerSocket(session, trackerToken, _secureMode = isSecureTrackingEnabled(), nowMs = Date.now()) {
  if (!session) {
    return { allowed: false, reason: 'INVALID_SESSION' };
  }
  if (!isTrackerCapabilityValid(session, trackerToken, nowMs)) {
    return { allowed: false, reason: 'INVALID_TRACKER_CAPABILITY' };
  }
  return { allowed: true, role: 'tracker' };
}

function authorizeSessionRead(
  session,
  { user, trackerToken, secureMode = isSecureTrackingEnabled(), nowMs = Date.now() }
) {
  if (!session) {
    return { allowed: false, reason: 'NOT_FOUND' };
  }
  if (user?.id && userOwnsSession(session, user.id, secureMode)) {
    return { allowed: true, mode: 'owner' };
  }
  if (isTrackerCapabilityValid(session, trackerToken, nowMs)) {
    return { allowed: true, mode: 'tracker' };
  }
  return { allowed: false, reason: 'FORBIDDEN' };
}

function buildTrackingPageUrl(publicBaseUrl, sessionId, trackerToken) {
  const base = String(publicBaseUrl || '').replace(/\/$/, '');
  const encoded = encodeURIComponent(trackerToken);
  return `${base}/track/${sessionId}?t=${encoded}`;
}

module.exports = {
  isSecureTrackingEnabled,
  isTrackerCapabilityValid,
  userOwnsSession,
  authorizeOwnerSocket,
  authorizeTrackerSocket,
  authorizeSessionRead,
  buildTrackingPageUrl,
};
