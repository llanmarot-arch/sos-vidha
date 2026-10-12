/**
 * Startup recovery for incidents and the notification outbox.
 *
 * SMS is not exactly-once. Twilio can accept a message and the process can still die before
 * that response is stored. Policy:
 *
 * - pending or retrying, with no provider id: the provider was not called. One dispatch is safe.
 *   A lease stops two workers from both taking that step.
 * - sending, with no provider id: the provider may already have accepted the message.
 *   Look up the provider record. A positive match is adopted and not sent again.
 *   If the lookup is missing, fails, or finds nothing, the attempt stays unconfirmed and is not sent again.
 * - accepted or sent: the provider has the message. That is not delivery.
 * - delivered: only a verified status callback, or a provider record whose own status is delivered.
 * - DISARMED, ended, revoked, or expired incidents are not restored and are not dispatched.
 *
 * Running recovery again is a no-op for work that is already settled or leased.
 * Recommended retention is 30 days after an incident ends. Nothing is deleted automatically.
 */

const RECOVERABLE = new Set(['ACTIVE', 'EMERGENCY', 'DURESS_ACTIVE']);

function isRecoverableIncident(incident, nowMs) {
  if (!incident || !RECOVERABLE.has(incident.status)) return false;
  if (incident.endedAt || incident.trackerRevokedAt) return false;
  if (incident.trackerExpiresAt != null && incident.trackerExpiresAt <= nowMs) return false;
  return true;
}

async function recoverActiveIncidents({
  incidents,
  now,
  restoreSession,
  dispatchSession,
  quarantineDeliveries,
}) {
  const nowMs = now();
  const rows = await incidents.listRecoverableIncidents(nowMs);
  let restored = 0;
  let skipped = 0;
  let quarantined = 0;

  for (const incident of rows) {
    if (!isRecoverableIncident(incident, nowMs)) {
      skipped += 1;
      continue;
    }
    const session = await restoreSession(incident);
    if (!session || session.status === 'DISARMED') {
      quarantined += await quarantineDeliveries(incident.id);
      skipped += 1;
      continue;
    }
    restored += 1;
    if (session.emergencyTriggeredAt) {
      await dispatchSession(session.sessionId);
    }
  }

  return { restored, skipped, quarantined };
}

module.exports = { recoverActiveIncidents, isRecoverableIncident };
