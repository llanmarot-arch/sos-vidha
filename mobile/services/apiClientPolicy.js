/**
 * Pure policy helpers for API client behavior (testable without React Native).
 */

export function isDevMockEnabledFromEnv(env = process.env) {
  return String(env.EXPO_PUBLIC_ALLOW_MOCK_API || '').toLowerCase() === 'true';
}

export function validateSessionStartResponse(session) {
  if (!session || typeof session !== 'object') {
    return { ok: false, error: 'Safety server returned an empty session response.' };
  }
  if (!session.sessionId || typeof session.sessionId !== 'string') {
    return { ok: false, error: 'Safety server response is missing a session identifier.' };
  }
  if (!session.trackingUrl || typeof session.trackingUrl !== 'string') {
    return { ok: false, error: 'Safety server response is missing a tracking link.' };
  }
  if (!session.disarmToken || typeof session.disarmToken !== 'string') {
    return { ok: false, error: 'Safety server response is missing disarm authorization.' };
  }
  return { ok: true };
}

export function userFacingBackendUnavailableMessage() {
  return (
    'SOS alert could not be sent. The safety server is unreachable and no session was created. ' +
    'If you are in immediate danger, use Call emergency services below or dial your local emergency number.'
  );
}

const LOCATION_ERROR_CODES = ['PERMISSION_DENIED', 'POSITION_UNAVAILABLE', 'TIMEOUT', 'UNSUPPORTED'];

/** Maps browser, Expo and wrapper location errors to the codes the server accepts. */
export function classifyLocationError(err) {
  const code = err?.code;
  if (LOCATION_ERROR_CODES.includes(code)) return code;
  if (code === 1) return 'PERMISSION_DENIED';
  if (code === 2) return 'POSITION_UNAVAILABLE';
  if (code === 3) return 'TIMEOUT';
  const text = `${code || ''} ${err?.message || ''}`.toLowerCase();
  if (text.includes('permission') || text.includes('denied') || text.includes('not authorized')) {
    return 'PERMISSION_DENIED';
  }
  if (text.includes('timeout') || text.includes('timed out')) return 'TIMEOUT';
  if (text.includes('unsupported') || text.includes('not supported')) return 'UNSUPPORTED';
  return 'POSITION_UNAVAILABLE';
}

const LOCATION_ERROR_TEXT = {
  PERMISSION_DENIED: 'location permission was denied',
  POSITION_UNAVAILABLE: 'the device could not get a GPS fix',
  TIMEOUT: 'the GPS did not respond in time',
  UNSUPPORTED: 'this device cannot provide GPS location',
};

export function describeLocationError(code) {
  return LOCATION_ERROR_TEXT[code] || LOCATION_ERROR_TEXT.POSITION_UNAVAILABLE;
}

/** Plain-language summary of the location the server recorded for the alert. */
export function describeAlertLocation(location) {
  if (!location) return 'Location status unknown.';
  switch (location.status) {
    case 'FRESH':
      return 'Your current GPS location was included.';
    case 'STALE':
      return 'Only an old GPS location was available. Contacts were told it may be out of date.';
    case 'LOW_ACCURACY':
      return 'Your GPS location was imprecise. Contacts were told it is low accuracy.';
    default:
      return 'Your location was not available. Contacts were told it is unavailable.';
  }
}

const DELIVERY_STATUS = {
  pending: { label: 'Preparing', tone: 'neutral' },
  sending: { label: 'Sending', tone: 'neutral' },
  retrying: { label: 'Retrying', tone: 'warning' },
  accepted: { label: 'Queued by provider (not yet confirmed sent)', tone: 'neutral' },
  sent: { label: 'Sent to carrier (delivery not yet confirmed)', tone: 'neutral' },
  delivered: { label: 'Delivered', tone: 'success' },
  undelivered: { label: 'Not delivered', tone: 'critical' },
  failed: { label: 'Failed to send', tone: 'critical' },
  unconfirmed: { label: 'Unknown - could not confirm whether it was sent', tone: 'warning' },
  dry_run: { label: 'Not sent (test mode)', tone: 'warning' },
  rate_limited: { label: 'Not sent (too many alerts this hour)', tone: 'critical' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const FINAL_DELIVERY_STATUSES = new Set([
  'delivered',
  'undelivered',
  'failed',
  'unconfirmed',
  'dry_run',
  'rate_limited',
  'cancelled',
]);

export function isFinalDeliveryStatus(status) {
  return FINAL_DELIVERY_STATUSES.has(status);
}

/** Never upgrades a status: "accepted" or "sent" is never described as delivered. */
export function describeDeliveryStatus(status) {
  return DELIVERY_STATUS[status] || { label: 'Status unknown', tone: 'neutral' };
}

export function describeChannel(channel) {
  if (channel === 'voice') return 'Phone call';
  if (channel === 'whatsapp') return 'WhatsApp';
  return 'Text message';
}
