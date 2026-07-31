const twilio = require('twilio');
const { resolvePublicServerUrl } = require('./serverUrl');

function createTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[Twilio] Missing credentials — voice/SMS will be logged only.');
    return null;
  }

  return {
    client: twilio(accountSid, authToken),
    fromNumber,
  };
}

function buildTrackingUrl(sessionId) {
  const base = resolvePublicServerUrl();
  return `${base}/track/${sessionId}`;
}

function buildEmergencyMessage(session) {
  const trackUrl = buildTrackingUrl(session.sessionId);
  const loc = session.location;
  const coords = loc
    ? `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
    : 'Location unavailable';

  return [
    'SOS-Vidha EMERGENCY ALERT',
    `Contact: ${session.userPhone}`,
    `Reason: ${session.emergencyReason || 'Safety alert triggered'}`,
    `Live location: ${coords}`,
    `Track live: ${trackUrl}`,
    'Please attempt to reach them immediately.',
  ].join('\n');
}

function buildVoiceTwiml(session) {
  const trackUrl = buildTrackingUrl(session.sessionId);
  const loc = session.location;
  const coords = loc
    ? `latitude ${loc.latitude.toFixed(4)}, longitude ${loc.longitude.toFixed(4)}`
    : 'location currently unavailable';

  const message = [
    'This is an automated emergency alert from SOS Vidha.',
    `A safety alert has been triggered for phone number ending in ${session.userPhone.slice(-4)}.`,
    `Last known coordinates: ${coords}.`,
    `Open the live tracking link sent via text message: ${trackUrl}.`,
    'Please try to contact them immediately.',
    'Repeating.',
    'This is an automated emergency alert from SOS Vidha.',
    `Last known coordinates: ${coords}.`,
    'Please try to contact them immediately.',
  ].join(' ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${escapeXml(message)}</Say>
  <Pause length="2"/>
  <Say voice="alice" language="en-US">${escapeXml(message)}</Say>
</Response>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function notifyEmergencyContacts(twilioBundle, session) {
  const contacts = [session.contact1, session.contact2].filter(Boolean);
  const body = buildEmergencyMessage(session);
  const twiml = buildVoiceTwiml(session);
  const results = { sms: [], calls: [] };

  if (!twilioBundle) {
    console.log('[Twilio:DRY-RUN] Emergency notification');
    console.log('Contacts:', contacts);
    console.log('SMS body:\n', body);
    console.log('TwiML:\n', twiml);
    return results;
  }

  const { client, fromNumber } = twilioBundle;

  for (const to of contacts) {
    try {
      const sms = await client.messages.create({
        from: fromNumber,
        to,
        body,
      });
      results.sms.push({ to, sid: sms.sid, status: 'sent' });
    } catch (err) {
      console.error(`[Twilio] SMS failed for ${to}:`, err.message);
      results.sms.push({ to, status: 'failed', error: err.message });
    }

    try {
      const call = await client.calls.create({
        from: fromNumber,
        to,
        twiml,
        machineDetection: 'Enable',
        timeout: 30,
      });
      results.calls.push({ to, sid: call.sid, status: 'initiated' });
    } catch (err) {
      console.error(`[Twilio] Call failed for ${to}:`, err.message);
      results.calls.push({ to, status: 'failed', error: err.message });
    }
  }

  return results;
}

async function notifyWhatsAppContacts(twilioBundle, contacts, message) {
  const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;
  const results = [];

  if (!twilioBundle || !whatsappFrom) {
    console.log('[Twilio:DRY-RUN] WhatsApp notification');
    contacts.forEach((to) => console.log(`  -> whatsapp:${to}\n${message}`));
    return contacts.map((to) => ({ to, status: 'dry-run' }));
  }

  const { client } = twilioBundle;

  for (const to of contacts) {
    try {
      const msg = await client.messages.create({
        from: `whatsapp:${whatsappFrom}`,
        to: `whatsapp:${to}`,
        body: message,
      });
      results.push({ to, sid: msg.sid, status: 'sent' });
    } catch (err) {
      console.error(`[Twilio] WhatsApp failed for ${to}:`, err.message);
      results.push({ to, status: 'failed', error: err.message });
    }
  }

  return results;
}

module.exports = {
  createTwilioClient,
  buildTrackingUrl,
  buildEmergencyMessage,
  buildVoiceTwiml,
  notifyEmergencyContacts,
  notifyWhatsAppContacts,
};
