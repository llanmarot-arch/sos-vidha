import { Platform, Linking } from 'react-native';
import { API_BASE_URL } from '../constants/config';

export function buildTrackingUrl(sessionId) {
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}/track/${sessionId}`;
}

export function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=17`;
}

/**
 * Message the user shares from their own device. Coordinates are only included with the
 * device fix time and accuracy; nothing is filled in when the device did not report it.
 */
export function buildShareMessage({ trackingUrl, latitude, longitude, timestamp, accuracy }) {
  const hasFix = Number.isFinite(latitude) && Number.isFinite(longitude) && timestamp != null;
  const lines = ['SOS-Vidha: I need help.'];

  if (hasFix) {
    const fixTime = new Date(timestamp).toLocaleString();
    const accuracyText = Number.isFinite(accuracy) ? `, accuracy about ${Math.round(accuracy)} m` : '';
    lines.push(`My GPS location at ${fixTime}${accuracyText}: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    lines.push(buildMapsUrl(latitude, longitude));
  } else {
    lines.push('My GPS location is not available right now.');
  }
  if (trackingUrl) {
    lines.push(`Live tracking: ${trackingUrl}`);
  }
  lines.push('Please call me. If you cannot reach me, call 112.');
  return lines.join('\n');
}

export async function copyToClipboard(text) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export async function shareLiveLocation(payload) {
  const message = buildShareMessage(payload);

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'SOS-Vidha Live Location',
        text: message,
        url: payload.trackingUrl,
      });
      return { method: 'native-share', success: true };
    } catch (err) {
      if (err?.name === 'AbortError') return { method: 'native-share', success: false, cancelled: true };
    }
  }

  const copied = await copyToClipboard(message);
  return { method: copied ? 'clipboard' : 'unavailable', success: copied, message };
}

export function openShareUrl(url) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  Linking.openURL(url);
  return true;
}
