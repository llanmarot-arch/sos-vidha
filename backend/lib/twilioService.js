const crypto = require('crypto');
const twilio = require('twilio');

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function buildTrackingUrl(publicServerUrl, sessionId, trackerToken) {
  const base = String(publicServerUrl || '').replace(/\/$/, '');
  return `${base}/track/${encodeURIComponent(sessionId)}?t=${encodeURIComponent(trackerToken)}`;
}

function maskPhone(phone) {
  const s = String(phone || '');
  return s.length > 4 ? `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : '****';
}

class ProviderConfigError extends Error {
  constructor(message) {
    super(message);
    this.code = 'PROVIDER_CONFIG';
  }
}

/**
 * transient: the provider definitively did not accept the request (429/5xx) - safe to retry.
 * permanent: the provider rejected the request (other 4xx, bad config) - do not retry.
 * ambiguous: no provider response (network error/timeout) - the message may or may not exist.
 */
function classifyProviderError(err) {
  if (err instanceof ProviderConfigError) return 'permanent';
  const status = Number(err?.status);
  if (Number.isFinite(status) && status > 0) {
    if (status === 429 || status >= 500) return 'transient';
    return 'permanent';
  }
  return 'ambiguous';
}

function createTwilioProvider(twilioConfig, { twilioFactory = twilio } = {}) {
  if (!twilioConfig?.configured) return null;
  const client = twilioFactory(twilioConfig.accountSid, twilioConfig.authToken);
  const fromNumber = twilioConfig.fromNumber;
  const whatsappFrom = twilioConfig.whatsappFrom;

  function addresses(channel, to) {
    if (channel === 'whatsapp') {
      if (!whatsappFrom) throw new ProviderConfigError('TWILIO_WHATSAPP_NUMBER is not configured');
      return { from: `whatsapp:${whatsappFrom}`, to: `whatsapp:${to}` };
    }
    return { from: fromNumber, to };
  }

  return {
    name: 'twilio',

    async send({ channel, to, body, twiml, statusCallback }) {
      if (channel === 'voice') {
        const call = await client.calls.create({ from: fromNumber, to, twiml, timeout: 30 });
        return { sid: call.sid, status: call.status || 'queued' };
      }
      const params = { ...addresses(channel, to), body };
      if (statusCallback) params.statusCallback = statusCallback;
      const msg = await client.messages.create(params);
      return { sid: msg.sid, status: msg.status };
    },

    /** Looks for a message we may already have created, so an ambiguous failure is not resent. */
    async findRecentMessage({ channel, to, bodySha256, sinceMs }) {
      if (channel === 'voice') return { supported: false, match: null };
      const { from, to: toAddress } = addresses(channel, to);
      const list = await client.messages.list({ to: toAddress, from, limit: 20 });
      const windowStart = sinceMs - 60 * 1000;
      const match = list.find(
        (m) => new Date(m.dateCreated).getTime() >= windowStart && sha256(m.body) === bodySha256
      );
      return { supported: true, match: match ? { sid: match.sid, status: match.status } : null };
    },

    validateWebhook({ signature, url, params }) {
      if (!signature) return false;
      return twilio.validateRequest(twilioConfig.authToken, signature, url, params);
    },
  };
}

module.exports = {
  sha256,
  buildTrackingUrl,
  maskPhone,
  classifyProviderError,
  createTwilioProvider,
  ProviderConfigError,
};
