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
 * Opens a WhatsApp chat for each contact with a pre-filled message the user sends themselves,
 * and asks the server to send its own WhatsApp alert for the session.
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
    // The server picks recipients and builds the message from its own records.
    const serverResult = await apiClient.sendWhatsAppAlerts({ sessionId: payload.sessionId });
    results.push({ method: 'server', status: 'requested', serverResult });
  } catch {
    console.info('[WhatsApp] Server dispatch unavailable; only wa.me links were opened');
  }

  return results;
}

export async function shareToContactWhatsApp(contact, payload) {
  const message = buildShareMessage(payload);
  const url = buildWhatsAppUrl(contact.phone, message);
  openShareUrl(url);
  return { contact: contact.name, status: 'opened' };
}
