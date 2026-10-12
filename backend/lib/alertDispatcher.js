const { sha256, maskPhone, classifyProviderError } = require('./twilioService');

const FINAL_STATUSES = new Set(['delivered', 'undelivered', 'failed']);
const SETTLED_STATUSES = new Set([
  'accepted',
  'sent',
  'delivered',
  'undelivered',
  'failed',
  'cancelled',
  'unconfirmed',
  'dry_run',
  'rate_limited',
]);
const STATUS_RANK = {
  pending: 0,
  sending: 1,
  retrying: 1,
  unconfirmed: 1,
  accepted: 2,
  sent: 3,
  delivered: 4,
  undelivered: 4,
  failed: 4,
};

/**
 * Maps a provider-reported status to our status. "accepted" means the provider queued the
 * message; it is never reported to anyone as sent or delivered.
 */
function mapProviderStatus(providerStatus) {
  switch (providerStatus) {
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
    case 'canceled':
      return 'failed';
    case 'accepted':
    case 'queued':
    case 'scheduled':
    case 'sending':
    case 'initiated':
    case 'ringing':
      return 'accepted';
    default:
      return null;
  }
}

function timestampFieldFor(status) {
  switch (status) {
    case 'accepted':
      return 'acceptedAt';
    case 'sent':
      return 'sentAt';
    case 'delivered':
      return 'deliveredAt';
    case 'undelivered':
    case 'failed':
      return 'failedAt';
    default:
      return null;
  }
}

function createAlertDispatcher({
  repo,
  provider,
  liveSend,
  maxAttempts = 3,
  retryBaseMs = 2000,
  leaseMs = 60000,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  logger = console,
  onUpdate = () => {},
}) {
  async function update(delivery, patch) {
    const updated = await repo.updateDelivery(delivery.id, patch);
    onUpdate(updated);
    return updated;
  }

  function providerResultPatch(result) {
    const status = mapProviderStatus(result.status) || 'accepted';
    const patch = { status, providerMessageSid: result.sid || null, providerStatus: result.status || null };
    const field = timestampFieldFor(status);
    if (field) patch[field] = now();
    return patch;
  }

  async function sendWithRetry(delivery, message) {
    let current = delivery;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = now();
      current = await update(current, { status: 'sending', attempts: attempt, lastAttemptAt: attemptStartedAt });
      try {
        const result = await provider.send(message);
        return update(current, providerResultPatch(result));
      } catch (err) {
        const kind = classifyProviderError(err);
        const providerErrorCode = err?.code != null ? String(err.code) : null;
        logger.warn(
          `[Alerts] ${message.channel} attempt ${attempt} to ${maskPhone(message.to)} failed (${kind}${
            providerErrorCode ? `, code ${providerErrorCode}` : ''
          })`
        );

        if (kind === 'permanent') {
          return update(current, { status: 'failed', providerErrorCode, failedAt: now() });
        }

        if (kind === 'ambiguous') {
          let lookup = null;
          try {
            lookup = await provider.findRecentMessage({
              channel: message.channel,
              to: message.to,
              bodySha256: message.bodySha256,
              sinceMs: attemptStartedAt,
            });
          } catch {
            lookup = null;
          }
          if (lookup?.match) {
            return update(current, providerResultPatch(lookup.match));
          }
          if (!lookup?.supported) {
            // Cannot prove the first attempt failed; resending could duplicate the alert.
            return update(current, { status: 'unconfirmed', providerErrorCode });
          }
        }

        if (attempt >= maxAttempts) {
          return update(current, { status: 'failed', providerErrorCode, failedAt: now() });
        }
        current = await update(current, { status: 'retrying', providerErrorCode });
        await sleep(retryBaseMs * 2 ** (attempt - 1));
      }
    }
    return current;
  }

  /**
   * A "sending" row with no provider id may already have been accepted. Adopt a provider match.
   * Anything else stays unconfirmed and is not sent again.
   */
  async function reconcileSending(delivery) {
    if (!provider || typeof provider.findRecentMessage !== 'function') {
      return update(delivery, { status: 'unconfirmed', providerErrorCode: 'RECONCILE_UNAVAILABLE' });
    }
    let lookup = null;
    try {
      lookup = await provider.findRecentMessage({
        channel: delivery.channel,
        to: delivery.toPhone,
        bodySha256: delivery.bodySha256,
        sinceMs: (delivery.lastAttemptAt || delivery.createdAt || now()) - 60000,
      });
    } catch {
      return update(delivery, { status: 'unconfirmed', providerErrorCode: 'RECONCILE_FAILED' });
    }
    if (lookup?.match) return update(delivery, providerResultPatch(lookup.match));
    return update(delivery, {
      status: 'unconfirmed',
      providerErrorCode: lookup?.supported ? 'RECONCILE_NO_MATCH' : 'RECONCILE_UNSUPPORTED',
    });
  }

  /**
   * One alert per (incident, recipient, channel). Settled rows are returned unchanged.
   * pending/retrying with a free lease may be sent once. sending without a provider id is reconciled,
   * never blindly resent.
   */
  async function resumeExisting(delivery, message, { rateLimited = false } = {}) {
    if (!delivery) return delivery;
    if (delivery.providerMessageSid || SETTLED_STATUSES.has(delivery.status)) return delivery;

    const leaseHeld = delivery.leaseUntil && delivery.leaseUntil > now();
    if (delivery.status === 'sending') {
      if (leaseHeld) return delivery;
      if (delivery.bodySha256 && message.bodySha256 && delivery.bodySha256 !== message.bodySha256) {
        return update(delivery, { status: 'unconfirmed', providerErrorCode: 'BODY_MISMATCH' });
      }
      return reconcileSending(delivery);
    }

    if (delivery.status !== 'pending' && delivery.status !== 'retrying') return delivery;
    if (leaseHeld) return delivery;
    if (rateLimited) return update(delivery, { status: 'rate_limited' });
    if (!liveSend || !provider) {
      logger.info(
        `[Alerts] DRY RUN: ${message.channel} to ${maskPhone(message.to)} for incident ${delivery.incidentId} not sent (message body not logged)`
      );
      return update(delivery, { status: 'dry_run' });
    }

    const acquired = await repo.acquireLease(delivery.id, leaseMs);
    if (!acquired.acquired) return acquired.delivery || delivery;
    let current = acquired.delivery;
    if (message.bodySha256 && current.bodySha256 !== message.bodySha256) {
      current = await update(current, { bodySha256: message.bodySha256 });
    }
    return sendWithRetry(current, message);
  }

  async function dispatch({ incident, recipients, channel, body = null, twiml = null, statusCallback = null, rateLimited = false }) {
    const payload = channel === 'voice' ? twiml : body;
    const bodySha256 = sha256(payload);
    const results = [];

    for (const recipient of recipients) {
      const claim = await repo.claimDelivery({
        incidentId: incident.id,
        userId: incident.userId,
        recipientKey: recipient.contactId || recipient.phone,
        contactId: recipient.contactId || null,
        recipientName: recipient.name || null,
        channel,
        toPhone: recipient.phone,
        bodySha256,
      });
      if (claim.claimed) onUpdate(claim.delivery);
      results.push(
        await resumeExisting(
          claim.delivery,
          {
            channel,
            to: recipient.phone,
            body,
            twiml,
            statusCallback: channel === 'voice' ? null : statusCallback,
            bodySha256,
          },
          { rateLimited }
        )
      );
    }
    return results;
  }

  /** Applies a verified provider status callback without ever moving a delivery backwards. */
  async function applyStatusCallback({ sid, providerStatus, errorCode }) {
    const delivery = await repo.findDeliveryBySid(sid);
    if (!delivery) return null;
    const status = mapProviderStatus(providerStatus);
    if (!status) return delivery;
    if (FINAL_STATUSES.has(delivery.status)) return delivery;
    if ((STATUS_RANK[status] ?? 0) < (STATUS_RANK[delivery.status] ?? 0)) return delivery;

    const patch = { status, providerStatus };
    if (errorCode) patch.providerErrorCode = String(errorCode);
    const field = timestampFieldFor(status);
    if (field) patch[field] = now();
    return update(delivery, patch);
  }

  return { dispatch, applyStatusCallback };
}

module.exports = { createAlertDispatcher, mapProviderStatus };
