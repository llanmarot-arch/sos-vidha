/**
 * Local SOS incident records. Pure functions only (no React Native imports) so they run under `node --test`.
 *
 * A local record proves only that SOS was pressed on this phone. It is never evidence that any alert was sent.
 * Records hold no auth tokens, disarm tokens, tracking links or phone numbers.
 */

export const INCIDENT_SCHEMA_VERSION = 1;

export const SYNC_STATUS = Object.freeze({
  LOCAL_ONLY: 'LOCAL_ONLY',
  WAITING_FOR_NETWORK: 'WAITING_FOR_NETWORK',
  SYNCING: 'SYNCING',
  SERVER_RECEIVED: 'SERVER_RECEIVED',
  SYNC_FAILED: 'SYNC_FAILED',
  CLOSED: 'CLOSED',
});

export const RECIPIENT_STATUS = Object.freeze({
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
  QUEUED_LOCALLY: 'QUEUED_LOCALLY',
  SUBMITTED_TO_PROVIDER: 'SUBMITTED_TO_PROVIDER',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
});

export const ROUTE = Object.freeze({ SERVER: 'server', DEVICE_SMS: 'device_sms' });

const OPEN_STATUSES = new Set([
  SYNC_STATUS.LOCAL_ONLY,
  SYNC_STATUS.WAITING_FOR_NETWORK,
  SYNC_STATUS.SYNCING,
  SYNC_STATUS.SYNC_FAILED,
]);

const INCIDENT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const LOCATION_ERRORS = ['PERMISSION_DENIED', 'POSITION_UNAVAILABLE', 'TIMEOUT', 'UNSUPPORTED'];

export function isValidIncidentId(id) {
  return typeof id === 'string' && INCIDENT_ID_RE.test(id);
}

/** Not yet confirmed by the server and not closed: the phone still owes a sync attempt. */
export function isUnsent(record) {
  return Boolean(record) && OPEN_STATUSES.has(record.status);
}

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Keeps a device fix only if it is a real fix with its own timestamp; never fills in missing values. */
export function sanitizeFix(fix) {
  if (!fix || typeof fix !== 'object') return null;
  const { latitude, longitude, timestamp } = fix;
  if (!finite(latitude) || !finite(longitude) || !finite(timestamp) || timestamp <= 0) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return {
    status: 'FIX',
    latitude,
    longitude,
    accuracyM: finite(fix.accuracy) && fix.accuracy >= 0 ? fix.accuracy : null,
    capturedAt: timestamp,
  };
}

export function locationFromCapture({ location, locationError }) {
  const fix = sanitizeFix(location);
  if (fix) return fix;
  const reason = LOCATION_ERRORS.includes(locationError) ? locationError : location ? 'INVALID_FIX' : 'NOT_PROVIDED';
  return { status: 'UNAVAILABLE', reason };
}

function localLedger(contacts) {
  return (contacts || [])
    .filter((c) => c && c.id != null)
    .slice(0, 10)
    .map((c) => ({
      key: `${ROUTE.SERVER}:local:${c.id}`,
      route: ROUTE.SERVER,
      channel: 'sms',
      contactId: String(c.id),
      recipientName: typeof c.name === 'string' ? c.name.slice(0, 60) : null,
      status: RECIPIENT_STATUS.QUEUED_LOCALLY,
      detail: 'Waiting to reach the SOS-Vidha server',
      providerMessageId: null,
      updatedAt: null,
    }));
}

/**
 * Creates the record written the moment SOS is confirmed. `activatedAt` is the phone clock.
 * Location starts as PENDING so a crash during the GPS request still leaves a truthful record.
 */
export function createIncidentRecord({ id, userId = null, activatedAt, contacts = [] }) {
  if (!isValidIncidentId(id)) throw new Error('A valid incident ID is required');
  if (!finite(activatedAt)) throw new Error('activatedAt must be the device time in ms');
  return {
    v: INCIDENT_SCHEMA_VERSION,
    id,
    userId,
    activatedAt,
    location: { status: 'PENDING' },
    status: SYNC_STATUS.LOCAL_ONLY,
    statusReason: null,
    sync: { attempts: 0, lastAttemptAt: null, nextAttemptAt: null, ambiguous: false, lastError: null },
    server: null,
    ledger: localLedger(contacts),
    closedAt: null,
    closeReason: null,
    updatedAt: activatedAt,
  };
}

/** Location the server should be told about, without inventing anything for a PENDING capture. */
export function locationForSync(record) {
  const loc = record.location;
  if (loc?.status === 'FIX') {
    return {
      location: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracyM, timestamp: loc.capturedAt },
      locationError: null,
    };
  }
  if (loc?.status === 'UNAVAILABLE' && LOCATION_ERRORS.includes(loc.reason)) {
    return { location: null, locationError: loc.reason };
  }
  return { location: null, locationError: null };
}

const SERVER_STATUS_MAP = {
  pending: [RECIPIENT_STATUS.NOT_ATTEMPTED, 'Not sent yet'],
  sending: [RECIPIENT_STATUS.UNKNOWN, 'Being sent by the server'],
  retrying: [RECIPIENT_STATUS.UNKNOWN, 'Server is retrying'],
  accepted: [RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER, 'Submitted to the SMS provider; delivery not confirmed'],
  sent: [RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER, 'Accepted by the carrier; delivery not confirmed'],
  delivered: [RECIPIENT_STATUS.DELIVERED, 'Delivered (confirmed by the carrier)'],
  undelivered: [RECIPIENT_STATUS.FAILED, 'Carrier could not deliver'],
  failed: [RECIPIENT_STATUS.FAILED, 'Failed to send'],
  unconfirmed: [RECIPIENT_STATUS.UNKNOWN, 'Outcome unknown; the server could not confirm it'],
  dry_run: [RECIPIENT_STATUS.NOT_ATTEMPTED, 'Not sent: the server is in test mode'],
  rate_limited: [RECIPIENT_STATUS.NOT_ATTEMPTED, 'Not sent: too many SOS alerts in the last hour'],
  cancelled: [RECIPIENT_STATUS.NOT_ATTEMPTED, 'Not sent: SOS was stopped first'],
};

/** Maps one owner-visible server delivery to a ledger entry. Only `delivered` ever becomes DELIVERED. */
export function ledgerEntryFromServer(delivery) {
  const [status, detail] = SERVER_STATUS_MAP[delivery?.status] || [RECIPIENT_STATUS.UNKNOWN, 'Status not recognised'];
  return {
    key: `${ROUTE.SERVER}:${delivery.id}`,
    route: ROUTE.SERVER,
    channel: delivery.channel || 'sms',
    contactId: null,
    recipientName: delivery.recipientName || null,
    to: delivery.to || null,
    status,
    detail,
    carrierAccepted: delivery.status === 'sent' || delivery.status === 'delivered',
    providerMessageId: delivery.providerMessageId || null,
    providerErrorCode: delivery.providerErrorCode ?? null,
    acceptedAt: delivery.acceptedAt ?? null,
    sentAt: delivery.sentAt ?? null,
    deliveredAt: delivery.deliveredAt ?? null,
    failedAt: delivery.failedAt ?? null,
    updatedAt: delivery.updatedAt ?? null,
  };
}

/** Replaces server-route entries with the server's authoritative list; keeps device SMS entries. */
export function mergeServerDeliveries(ledger, deliveries) {
  const device = (ledger || []).filter((e) => e.route !== ROUTE.SERVER);
  return [...(deliveries || []).filter((d) => d?.id).map(ledgerEntryFromServer), ...device];
}

/** After the server confirms the incident but before per-message status is known. */
export function markServerEntriesAwaitingStatus(ledger) {
  return (ledger || []).map((e) =>
    e.route === ROUTE.SERVER && e.status === RECIPIENT_STATUS.QUEUED_LOCALLY
      ? { ...e, status: RECIPIENT_STATUS.UNKNOWN, detail: 'Server received the SOS; message status not loaded yet' }
      : e
  );
}

/**
 * What the system composer actually reported. None of these is carrier delivery.
 * Android's expo-sms always returns `unknown` (the SMS app does not report a result).
 * iOS `sent` means the user tapped Send and Messages accepted the handoff.
 */
export function interpretComposerResult(composerResult) {
  switch (composerResult) {
    case 'cancelled':
      return {
        status: RECIPIENT_STATUS.NOT_ATTEMPTED,
        stage: 'composer_closed',
        detail: 'Messages was opened, then closed without sending',
      };
    case 'sent':
      return {
        status: RECIPIENT_STATUS.UNKNOWN,
        stage: 'handed_to_messages',
        detail: 'Handed to the phone’s Messages app; sending and delivery are not confirmed',
      };
    case 'failed':
      return {
        status: RECIPIENT_STATUS.FAILED,
        stage: 'composer_failed',
        detail: 'The phone reported this text could not be sent. It was not delivered.',
      };
    default:
      return {
        status: RECIPIENT_STATUS.UNKNOWN,
        stage: 'composer_opened',
        detail: 'Messages was opened. This app cannot tell whether it was sent or delivered.',
      };
  }
}

export function describeComposerResult(composerResult) {
  switch (composerResult) {
    case 'cancelled':
      return 'You closed Messages without sending. No text was sent from this phone.';
    case 'sent':
      return 'Your phone handed the text to Messages. SOS-Vidha cannot confirm it was sent or delivered.';
    case 'failed':
      return 'Your phone reported the text could not be sent. It was not delivered.';
    default:
      return 'Messages was opened. SOS-Vidha cannot tell whether you pressed send, or whether the text was sent or delivered.';
  }
}

/** Replaces this incident's device-SMS rows. A repeat does not add a second row per contact. */
export function recordDeviceSmsAttempt(ledger, contacts, { openedAt, composerResult }) {
  const others = (ledger || []).filter((e) => e.route !== ROUTE.DEVICE_SMS);
  const interpreted = interpretComposerResult(composerResult);
  const entries = (contacts || []).map((c) => ({
    key: `${ROUTE.DEVICE_SMS}:${c.id}`,
    route: ROUTE.DEVICE_SMS,
    channel: 'sms',
    contactId: String(c.id),
    recipientName: typeof c.name === 'string' ? c.name.slice(0, 60) : null,
    status: interpreted.status,
    stage: interpreted.stage,
    detail: interpreted.detail,
    providerMessageId: null,
    updatedAt: openedAt,
  }));
  return [...others, ...entries];
}

/** True when a previous phone text might already have gone out, so another one needs an explicit choice. */
export function deviceSmsDuplicateRisk(ledger) {
  return (ledger || []).some((e) => e.route === ROUTE.DEVICE_SMS && e.status === RECIPIENT_STATUS.UNKNOWN);
}

/**
 * The composer is a user fallback, not a second automatic alert.
 * Hidden while a server send is in progress or already accepted/delivered/in an unknown state.
 */
export function deviceSmsOffer(record) {
  if (!record || record.status === SYNC_STATUS.CLOSED || record.status === SYNC_STATUS.SYNCING) {
    return { show: false, duplicateRisk: false };
  }
  const serverSms = (record.ledger || []).filter((e) => e.route === ROUTE.SERVER && e.channel === 'sms');
  const serverDidNotSend =
    serverSms.length === 0 ||
    serverSms.every(
      (e) =>
        e.status === RECIPIENT_STATUS.NOT_ATTEMPTED ||
        e.status === RECIPIENT_STATUS.FAILED ||
        e.status === RECIPIENT_STATUS.QUEUED_LOCALLY
    );
  const show = isUnsent(record) || (record.status === SYNC_STATUS.SERVER_RECEIVED && serverDidNotSend);
  return { show, duplicateRisk: deviceSmsDuplicateRisk(record.ledger) };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats a phone-clock time with its UTC offset, without depending on Intl time-zone support. */
export function formatClock(ms, offsetMinutes = -new Date(ms).getTimezoneOffset()) {
  const d = new Date(ms + offsetMinutes * 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}:${pad(d.getUTCSeconds())} UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function formatAge(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

const LOCATION_REASON_TEXT = {
  PERMISSION_DENIED: 'location permission was denied',
  POSITION_UNAVAILABLE: 'the phone could not get a GPS fix',
  TIMEOUT: 'the phone timed out getting a GPS fix',
  UNSUPPORTED: 'this device does not support location',
  INVALID_FIX: 'the GPS reading was invalid',
  NOT_PROVIDED: 'no GPS fix was recorded',
};

export function describeIncidentLocation(record, { nowMs, offsetMinutes } = {}) {
  const loc = record?.location;
  if (!loc || loc.status === 'PENDING') return 'Location: still being captured, or capture was interrupted.';
  if (loc.status !== 'FIX') {
    return `Location: UNAVAILABLE (${LOCATION_REASON_TEXT[loc.reason] || LOCATION_REASON_TEXT.NOT_PROVIDED}).`;
  }
  const acc = loc.accuracyM != null ? `±${Math.round(loc.accuracyM)} m` : 'accuracy not reported';
  const age = finite(nowMs) ? `, ${formatAge(nowMs - loc.capturedAt)} ago` : '';
  return `Location: GPS fix at ${formatClock(loc.capturedAt, offsetMinutes)} (${acc}${age}).`;
}

const REASON_TEXT = {
  AUTH_REQUIRED: 'Sign in again to send this SOS. It is saved on this phone.',
  ACCOUNT_MISMATCH: 'This SOS belongs to a different account than the one signed in, so it cannot be sent from here.',
  NO_CONTACTS: 'The server has no valid emergency contacts for your account, so no alert can be sent.',
  REJECTED: 'The server rejected this SOS.',
  RETRY_LIMIT: 'Automatic retries stopped. Tap “Try sending again” when you have signal.',
  SERVER_UNAVAILABLE: 'The SOS-Vidha server is temporarily unavailable.',
  NETWORK: 'No connection to the SOS-Vidha server.',
  RATE_LIMITED: 'The server is limiting SOS requests right now.',
  INTERRUPTED: 'A previous send attempt was interrupted; its outcome is unknown.',
  CONTACTS_UNAVAILABLE: 'The server could not load your emergency contacts.',
};

export function describeReason(code) {
  return REASON_TEXT[code] || null;
}

/**
 * The headline shown for an incident. Wording never implies an alert went out unless the server confirmed it.
 */
export function describeIncident(record, { offsetMinutes } = {}) {
  if (!record) return null;
  const pressed = `SOS pressed at ${formatClock(record.activatedAt, offsetMinutes)} (phone clock).`;
  const reason = describeReason(record.statusReason);
  const maybeSent = record.sync?.ambiguous
    ? ' An earlier attempt may have reached the server before the connection dropped, so your contacts may already have been alerted.'
    : '';
  switch (record.status) {
    case SYNC_STATUS.LOCAL_ONLY:
      return { tone: 'critical', title: 'Saved on this phone only', text: `${pressed} No alert has been sent yet.` };
    case SYNC_STATUS.WAITING_FOR_NETWORK:
      return {
        tone: 'critical',
        title: 'Waiting for a connection',
        text: `${pressed} Saved on this phone. No alert is confirmed as sent.${maybeSent}${reason ? ` ${reason}` : ''}`,
      };
    case SYNC_STATUS.SYNCING:
      return { tone: 'warning', title: 'Sending to the server…', text: `${pressed} Not confirmed yet.` };
    case SYNC_STATUS.SERVER_RECEIVED: {
      if (record.statusReason === 'DELIVERY_UNCONFIRMED') {
        return {
          tone: 'warning',
          title: 'Server has this SOS — delivery not confirmed',
          text: `${pressed} This phone did not get proof that contacts were notified. If you still need help, call emergency services or start a new SOS.`,
        };
      }
      const serverRows = (record.ledger || []).filter((entry) => entry.route === ROUTE.SERVER);
      if (
        serverRows.length > 0 &&
        serverRows.every(
          (entry) => entry.status === RECIPIENT_STATUS.UNKNOWN && /Outcome unknown/.test(entry.detail || '')
        )
      ) {
        return {
          tone: 'warning',
          title: 'Server has this SOS — delivery not confirmed',
          text: `${pressed} The server recorded it, and the notification outcome is unknown. If you still need help, call emergency services.`,
        };
      }
      const at = record.server?.receivedAt ? ` at ${formatClock(record.server.receivedAt, offsetMinutes)}` : '';
      return {
        tone: 'success',
        title: 'Server received your SOS',
        text: `${pressed} The SOS-Vidha server recorded it${at}. Check each contact’s status below.`,
      };
    }
    case SYNC_STATUS.SYNC_FAILED:
      return {
        tone: 'critical',
        title: 'SOS not sent',
        text: `${pressed} No alert is confirmed as sent.${maybeSent}${reason ? ` ${reason}` : ''}`,
      };
    case SYNC_STATUS.CLOSED: {
      const never = record.server
        ? ''
        : record.sync?.ambiguous
          ? ' It was closed before the server confirmed it; an earlier attempt may still have reached the server.'
          : ' It was never sent to the server.';
      return { tone: 'neutral', title: 'Closed on this phone', text: `${pressed}${never}` };
    }
    default:
      return { tone: 'neutral', title: 'Unknown state', text: pressed };
  }
}

const TRACK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPABILITY_RE = /^[0-9a-f]{64}$/i;

/**
 * A tracking link is included only when it is a real backend capability URL.
 * A session id, a missing token, or a non-local http URL is rejected. Nothing is invented.
 */
export function acceptTrackingUrl(url) {
  if (typeof url !== 'string' || url.length > 500) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) return null;
  if (parsed.username || parsed.password) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'track' || !TRACK_ID_RE.test(parts[1])) return null;
  const token = parsed.searchParams.get('t');
  if (!token || !CAPABILITY_RE.test(token)) return null;
  return `${parsed.protocol}//${parsed.host}/track/${parts[1]}?t=${token}`;
}

/** The in-memory session link, only when that session is this incident. Never read from storage. */
export function trackingUrlForIncident(record, live) {
  if (!record || !live) return null;
  const sameLocal = live.localIncidentId && live.localIncidentId === record.id;
  const sameServer = record.server?.incidentId && live.sessionId === record.server.incidentId;
  if (!sameLocal && !sameServer) return null;
  return acceptTrackingUrl(live.trackingUrl);
}

/** Verified-facts text for the user's own Messages app. The tracking link is included only when accepted above. */
export function buildDeviceSmsBody(
  record,
  { profileName = null, nowMs, offsetMinutes, emergencyNumber = '112', trackingUrl = null } = {}
) {
  const name = typeof profileName === 'string' && profileName.trim() ? profileName.trim().slice(0, 60) : null;
  const lines = ['SOS-Vidha EMERGENCY'];
  lines.push(`${name || 'I'} pressed SOS at ${formatClock(record.activatedAt, offsetMinutes)} (phone clock).`);
  const loc = record.location;
  if (loc?.status === 'FIX') {
    const coords = `${loc.latitude.toFixed(5)},${loc.longitude.toFixed(5)}`;
    const acc = loc.accuracyM != null ? `±${Math.round(loc.accuracyM)} m` : 'accuracy not reported';
    const age = finite(nowMs) ? `, ${formatAge(nowMs - loc.capturedAt)} before this message` : '';
    lines.push(`GPS fix at ${formatClock(loc.capturedAt, offsetMinutes)} (${acc}${age}):`);
    lines.push(`https://maps.google.com/?q=${coords}`);
  } else {
    lines.push(describeIncidentLocation(record));
  }
  const link = acceptTrackingUrl(trackingUrl);
  if (link) lines.push(`Live tracking while this SOS is active: ${link}`);
  lines.push(`Please call me. If you cannot reach me, call ${emergencyNumber}.`);
  return lines.join('\n');
}
