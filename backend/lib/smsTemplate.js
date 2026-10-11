/**
 * Deterministic emergency message templates. Every value comes from validated backend data;
 * anything missing is stated as unavailable rather than filled in.
 */

const UNAVAILABLE_REASON_TEXT = {
  PERMISSION_DENIED: 'location permission was denied on their device',
  POSITION_UNAVAILABLE: 'their device could not get a GPS fix',
  TIMEOUT: 'their device timed out getting a GPS fix',
  UNSUPPORTED: 'their device does not support location',
  NOT_PROVIDED: 'no GPS fix was received',
  INVALID_COORDINATES: 'the location received failed validation',
  MISSING_TIMESTAMP: 'the location received had no fix time',
  FUTURE_TIMESTAMP: 'the location received had an invalid fix time',
};

function formatTime(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')} ${get('month')} ${get('year')} ${get('hour')}:${get('minute')}:${get('second')} ${get('timeZoneName')}`;
}

function formatDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatAge(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const cleaned = name
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned || null;
}

function accuracyText(location) {
  return location.accuracy != null ? `accuracy +/-${Math.round(location.accuracy)} m` : 'accuracy not reported';
}

function coordsText(location) {
  return `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

function buildLocationLines(assessment, address, timeZone) {
  if (assessment.status === 'UNAVAILABLE') {
    const why = UNAVAILABLE_REASON_TEXT[assessment.reason] || UNAVAILABLE_REASON_TEXT.NOT_PROVIDED;
    return [`Location: UNAVAILABLE (${why}).`];
  }

  const loc = assessment.location;
  const fix = `GPS fix at ${formatTime(loc.timestamp, timeZone)}, ${accuracyText(loc)}`;
  const lines = [];
  if (assessment.status === 'STALE') {
    lines.push(
      `Location: STALE - last GPS fix was ${formatAge(assessment.ageMs)} before this alert was sent (${fix}). It may not show where they are now.`
    );
  } else if (assessment.status === 'LOW_ACCURACY') {
    lines.push(`Location: LOW ACCURACY (${fix}).`);
  } else {
    lines.push(`Location (${fix}):`);
  }
  lines.push(coordsText(loc));
  lines.push(`Map: https://maps.google.com/?q=${coordsText(loc)}`);
  if (address?.text && address?.provider) {
    lines.push(`Approx. address (${address.provider} lookup of this GPS point): ${address.text}`);
  }
  return lines;
}

function buildSafetyZoneLine(zone) {
  if (!zone?.configured) return null;
  const radius = `Safety zone: ${formatDistance(zone.radiusM)} radius.`;
  if (zone.distanceM == null) {
    return `${radius} Distance not calculated because the location is not a fresh, accurate GPS fix.`;
  }
  const where = zone.outside ? 'outside' : 'inside';
  return `${radius} GPS point is ${formatDistance(zone.distanceM)} from its centre (${where} the zone).`;
}

const DELAY_NOTICE_AFTER_MS = 2 * 60 * 1000;

/** True when the phone recorded SOS noticeably earlier than the server received it (e.g. no signal). */
function isDelayedActivation(activatedAtMs, deviceActivatedAtMs) {
  return Number.isFinite(deviceActivatedAtMs) && activatedAtMs - deviceActivatedAtMs > DELAY_NOTICE_AFTER_MS;
}

function buildEmergencySms({
  profileName,
  activatedAtMs,
  deviceActivatedAtMs = null,
  assessment,
  address = null,
  safetyZone = null,
  trackingUrl,
  trackerExpiresAtMs,
  timeZone,
  emergencyNumber,
}) {
  if (!Number.isFinite(activatedAtMs)) throw new Error('activatedAtMs is required');
  if (!trackingUrl) throw new Error('trackingUrl is required');
  if (!assessment?.status) throw new Error('location assessment is required');

  const name = sanitizeName(profileName);
  const at = formatTime(activatedAtMs, timeZone);
  const lines = ['SOS-Vidha EMERGENCY ALERT'];
  if (isDelayedActivation(activatedAtMs, deviceActivatedAtMs)) {
    const pressed = formatTime(deviceActivatedAtMs, timeZone);
    lines.push(
      name
        ? `DELAYED ALERT: ${name} pressed SOS on their phone at ${pressed} (phone clock). It reached the SOS-Vidha server at ${at}.`
        : `DELAYED ALERT: SOS was pressed at ${pressed} (phone clock) by someone who listed you as an emergency contact (name not on file). It reached the SOS-Vidha server at ${at}.`
    );
  } else {
    lines.push(
      name
        ? `${name} activated SOS at ${at}.`
        : `SOS was activated at ${at} by someone who listed you as an emergency contact (name not on file).`
    );
  }
  lines.push(...buildLocationLines(assessment, address, timeZone));
  const zoneLine = buildSafetyZoneLine(safetyZone);
  if (zoneLine) lines.push(zoneLine);
  const expiry = Number.isFinite(trackerExpiresAtMs) ? ` (link expires ${formatTime(trackerExpiresAtMs, timeZone)})` : '';
  lines.push(`Live tracking${expiry}: ${trackingUrl}`);
  lines.push(`Please call them now. If you cannot reach them, call ${emergencyNumber}.`);
  return lines.join('\n');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildVoiceTwiml({ profileName, activatedAtMs, deviceActivatedAtMs = null, timeZone, emergencyNumber }) {
  const name = sanitizeName(profileName);
  const who = name || 'someone who listed you as an emergency contact';
  const when = isDelayedActivation(activatedAtMs, deviceActivatedAtMs)
    ? `${who} pressed S O S on their phone at ${formatTime(deviceActivatedAtMs, timeZone)}, but it only reached our server at ${formatTime(activatedAtMs, timeZone)}.`
    : `${who} activated S O S at ${formatTime(activatedAtMs, timeZone)}.`;
  const message = [
    'This is an automated emergency alert from S O S Vidha.',
    when,
    'This call does not include their location. Check your text messages for an S O S Vidha alert, or call them directly.',
    `If you cannot reach them, call ${emergencyNumber}.`,
  ].join(' ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-IN">${escapeXml(message)}</Say>
  <Pause length="2"/>
  <Say language="en-IN">${escapeXml(message)}</Say>
</Response>`;
}

module.exports = {
  buildEmergencySms,
  buildVoiceTwiml,
  isDelayedActivation,
  formatTime,
  formatDistance,
  sanitizeName,
  escapeXml,
};
