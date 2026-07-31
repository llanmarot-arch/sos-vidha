import { Platform } from 'react-native';
import { buildShareMessage, openShareUrl } from './locationShareService';
import { apiClient } from './apiClient';

function normalizeWhatsAppPhone(phone) {
  return String(phone).replace(/\D/g, '');
}

export function buildWhatsAppUrl(phone, message) {
  const digits = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Opens WhatsApp chat for each contact with pre-filled SOS + live tracking message.
 * Also attempts server-side Twilio WhatsApp dispatch when backend is online.
 */
export async function dispatchWhatsAppAlerts(contacts, payload) {
  const message = buildShareMessage(payload);
  const results = [];

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    contacts.forEach((contact, index) => {
      const url = buildWhatsAppUrl(contact.phone, message);
      setTimeout(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      }, index * 600);
      results.push({ contact: contact.name, phone: contact.phone, method: 'wa.me', status: 'opened' });
    });
  } else {
    contacts.forEach((contact) => {
      openShareUrl(buildWhatsAppUrl(contact.phone, message));
      results.push({ contact: contact.name, phone: contact.phone, method: 'wa.me', status: 'opened' });
    });
  }

  try {
    const serverResult = await apiClient.sendWhatsAppAlerts({
      contacts: contacts.map((c) => c.phone),
      message,
      sessionId: payload.sessionId,
      trackingUrl: payload.trackingUrl,
    });
    results.push({ method: 'server', status: 'dispatched', serverResult });
  } catch {
    console.info('[WhatsApp] Server dispatch skipped — client wa.me links opened');
  }

  console.info(`[WhatsApp] Live location shared to ${contacts.length} contact(s)`);
  return results;
}

export async function shareToContactWhatsApp(contact, payload) {
  const message = buildShareMessage(payload);
  const url = buildWhatsAppUrl(contact.phone, message);
  openShareUrl(url);
  return { contact: contact.name, status: 'opened' };
}
