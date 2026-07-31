import { Platform, Linking } from 'react-native';
import { API_BASE_URL } from '../constants/config';

export function buildTrackingUrl(sessionId) {
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}/track/${sessionId}`;
}

export function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=17`;
}

export function buildShareMessage({ trackingUrl, latitude, longitude, sessionId }) {
  const coords =
    latitude != null && longitude != null
      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      : 'Awaiting GPS fix';
  const mapLink =
    latitude != null && longitude != null ? buildMapsUrl(latitude, longitude) : trackingUrl;

  return [
    'SOS-VIDHA LIVE LOCATION ALERT',
    'Emergency protocol activated. Track my live position:',
    trackingUrl || mapLink,
    `Current coordinates: ${coords}`,
    `Session: ${sessionId || 'ACTIVE'}`,
    'Please respond immediately.',
  ].join('\n');
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
