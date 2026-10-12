/**
 * Persistence for SOS incidents and per-recipient alert deliveries.
 *
 * Idempotency rules (enforced by both implementations, and by unique constraints in Postgres):
 *  - one incident per (user, clientRequestId)
 *  - one delivery per (incident, recipient, channel)
 */

const DELIVERY_FIELDS = [
  'status',
  'attempts',
  'providerMessageSid',
  'providerStatus',
  'providerErrorCode',
  'bodySha256',
  'leaseUntil',
  'lastAttemptAt',
  'acceptedAt',
  'sentAt',
  'deliveredAt',
  'failedAt',
];

const RECOVERABLE_STATUSES = ['ACTIVE', 'EMERGENCY', 'DURESS_ACTIVE'];

const INCIDENT_PATCH_FIELDS = ['status', 'emergencyAt', 'endedAt', 'trackerRevokedAt'];

function pick(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

class MemoryIncidentRepository {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.incidents = new Map();
    this.requestIndex = new Map();
    this.deliveries = new Map();
    this.deliveryKeys = new Map();
    this.sidIndex = new Map();
    this.seq = 0;
  }

  async createIncident(record) {
    if (record.userId && record.clientRequestId) {
      const key = `${record.userId}:${record.clientRequestId}`;
      const existingId = this.requestIndex.get(key);
      if (existingId) {
        return { incident: { ...this.incidents.get(existingId) }, created: false };
      }
      this.requestIndex.set(key, record.id);
    }
    const incident = { ...record, createdAt: this.now(), updatedAt: this.now() };
    this.incidents.set(record.id, incident);
    return { incident: { ...incident }, created: true };
  }

  async getIncident(id) {
    const incident = this.incidents.get(id);
    return incident ? { ...incident } : null;
  }

  async updateIncident(id, patch) {
    const incident = this.incidents.get(id);
    if (!incident) return null;
    Object.assign(incident, pick(patch, INCIDENT_PATCH_FIELDS), { updatedAt: this.now() });
    return { ...incident };
  }

  async countEmergencyIncidentsSince(userId, sinceMs, excludeId) {
    let count = 0;
    for (const incident of this.incidents.values()) {
      if (incident.userId !== userId || incident.id === excludeId) continue;
      if (incident.emergencyAt != null && incident.emergencyAt >= sinceMs) count += 1;
    }
    return count;
  }

  async claimDelivery(input) {
    const key = `${input.incidentId}:${input.recipientKey}:${input.channel}`;
    const existingId = this.deliveryKeys.get(key);
    if (existingId) {
      return { claimed: false, delivery: { ...this.deliveries.get(existingId) } };
    }
    this.seq += 1;
    const delivery = {
      id: `dlv-${this.seq}`,
      incidentId: input.incidentId,
      userId: input.userId || null,
      contactId: input.contactId || null,
      recipientKey: input.recipientKey,
      recipientName: input.recipientName || null,
      channel: input.channel,
      toPhone: input.toPhone,
      bodySha256: input.bodySha256 || null,
      idempotencyKey: `${input.incidentId}:${input.recipientKey}:${input.channel}`,
      status: 'pending',
      attempts: 0,
      leaseUntil: null,
      providerMessageSid: null,
      providerStatus: null,
      providerErrorCode: null,
      lastAttemptAt: null,
      acceptedAt: null,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.deliveries.set(delivery.id, delivery);
    this.deliveryKeys.set(key, delivery.id);
    return { claimed: true, delivery: { ...delivery } };
  }

  async updateDelivery(id, patch) {
    const delivery = this.deliveries.get(id);
    if (!delivery) return null;
    Object.assign(delivery, pick(patch, DELIVERY_FIELDS), { updatedAt: this.now() });
    if (delivery.providerMessageSid) this.sidIndex.set(delivery.providerMessageSid, id);
    return { ...delivery };
  }

  async findDeliveryBySid(sid) {
    const id = this.sidIndex.get(sid);
    return id ? { ...this.deliveries.get(id) } : null;
  }

  async listDeliveries(incidentId) {
    return [...this.deliveries.values()]
      .filter((d) => d.incidentId === incidentId)
      .map((d) => ({ ...d }));
  }

  async listRecoverableIncidents(nowMs) {
    const out = [];
    for (const incident of this.incidents.values()) {
      if (!RECOVERABLE_STATUSES.includes(incident.status)) continue;
      if (incident.endedAt || incident.trackerRevokedAt) continue;
      if (incident.trackerExpiresAt != null && incident.trackerExpiresAt <= nowMs) continue;
      out.push({ ...incident, location: incident.location ? { ...incident.location } : null });
    }
    return out;
  }

  async updateIncidentLocation(id, patch) {
    const incident = this.incidents.get(id);
    if (!incident) return null;
    if (patch.location) incident.location = { ...patch.location };
    if (patch.locationStatus) incident.locationStatus = patch.locationStatus;
    if (patch.locationUnavailableReason !== undefined) {
      incident.locationUnavailableReason = patch.locationUnavailableReason;
    }
    incident.updatedAt = this.now();
    return { ...incident, location: incident.location ? { ...incident.location } : null };
  }

  /** Sets a lease without changing status. pending still means the provider was not called. */
  async acquireLease(id, leaseMs) {
    const delivery = this.deliveries.get(id);
    if (!delivery) return { acquired: false, delivery: null };
    if (delivery.providerMessageSid || !['pending', 'retrying'].includes(delivery.status)) {
      return { acquired: false, delivery: { ...delivery } };
    }
    const now = this.now();
    if (delivery.leaseUntil && delivery.leaseUntil > now) {
      return { acquired: false, delivery: { ...delivery } };
    }
    delivery.leaseUntil = now + leaseMs;
    delivery.updatedAt = now;
    return { acquired: true, delivery: { ...delivery } };
  }
}

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const ms = (value) => (value == null ? null : new Date(value).getTime());

function incidentToRow(r) {
  return {
    id: r.id,
    user_id: r.userId,
    client_request_id: r.clientRequestId || null,
    status: r.status,
    mode: r.mode,
    activated_at: iso(r.activatedAt),
    device_activated_at: iso(r.deviceActivatedAt),
    emergency_at: iso(r.emergencyAt),
    location_latitude: r.location?.latitude ?? null,
    location_longitude: r.location?.longitude ?? null,
    location_accuracy_m: r.location?.accuracy ?? null,
    location_captured_at: iso(r.location?.timestamp),
    location_status: r.locationStatus,
    location_unavailable_reason: r.locationUnavailableReason || null,
    safe_zone_latitude: r.safeZone?.latitude ?? null,
    safe_zone_longitude: r.safeZone?.longitude ?? null,
    safe_zone_radius_m: r.safeZone?.radiusM ?? null,
    distance_from_safe_zone_m: r.distanceFromSafeZoneM ?? null,
    tracker_token_sha256: r.trackerTokenSha256,
    tracker_expires_at: iso(r.trackerExpiresAt),
  };
}

function incidentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    clientRequestId: row.client_request_id,
    status: row.status,
    mode: row.mode,
    activatedAt: ms(row.activated_at),
    deviceActivatedAt: ms(row.device_activated_at),
    emergencyAt: ms(row.emergency_at),
    endedAt: ms(row.ended_at),
    locationStatus: row.location_status,
    locationUnavailableReason: row.location_unavailable_reason,
    location:
      row.location_latitude == null
        ? null
        : {
            latitude: row.location_latitude,
            longitude: row.location_longitude,
            accuracy: row.location_accuracy_m,
            timestamp: ms(row.location_captured_at),
          },
    safeZone:
      row.safe_zone_latitude == null
        ? null
        : {
            latitude: row.safe_zone_latitude,
            longitude: row.safe_zone_longitude,
            radiusM: row.safe_zone_radius_m,
          },
    trackerTokenSha256: row.tracker_token_sha256,
    trackerExpiresAt: ms(row.tracker_expires_at),
    trackerRevokedAt: ms(row.tracker_revoked_at),
    createdAt: ms(row.created_at),
    runtimeEnc: row.runtime_enc || null,
  };
}

const DELIVERY_COLUMN = {
  status: 'status',
  attempts: 'attempts',
  providerMessageSid: 'provider_message_sid',
  providerStatus: 'provider_status',
  providerErrorCode: 'provider_error_code',
  bodySha256: 'body_sha256',
  leaseUntil: 'lease_until',
  lastAttemptAt: 'last_attempt_at',
  acceptedAt: 'accepted_at',
  sentAt: 'sent_at',
  deliveredAt: 'delivered_at',
  failedAt: 'failed_at',
};
const TIME_FIELDS = new Set(['leaseUntil', 'lastAttemptAt', 'acceptedAt', 'sentAt', 'deliveredAt', 'failedAt']);

function deliveryFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    incidentId: row.incident_id,
    userId: row.user_id,
    contactId: row.contact_id,
    recipientKey: row.recipient_key,
    recipientName: row.recipient_name,
    channel: row.channel,
    toPhone: row.to_phone_e164,
    bodySha256: row.body_sha256,
    idempotencyKey: row.idempotency_key || null,
    leaseUntil: ms(row.lease_until),
    status: row.status,
    attempts: row.attempts,
    providerMessageSid: row.provider_message_sid,
    providerStatus: row.provider_status,
    providerErrorCode: row.provider_error_code,
    lastAttemptAt: ms(row.last_attempt_at),
    acceptedAt: ms(row.accepted_at),
    sentAt: ms(row.sent_at),
    deliveredAt: ms(row.delivered_at),
    failedAt: ms(row.failed_at),
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
  };
}

const UNIQUE_VIOLATION = '23505';

class SupabaseIncidentRepository {
  constructor(admin) {
    this.db = admin;
  }

  async attachRuntime(incident) {
    if (!incident) return null;
    const { data, error } = await this.db
      .from('sos_incident_runtime')
      .select('runtime_enc')
      .eq('incident_id', incident.id)
      .maybeSingle();
    if (error) throw new Error('Failed to read incident runtime');
    return { ...incident, runtimeEnc: data?.runtime_enc || null };
  }

  async createIncident(record) {
    const { data, error } = await this.db.rpc('persist_sos_incident', {
      p_incident: incidentToRow(record),
      p_runtime_enc: record.runtimeEnc || null,
    });
    if (error) throw new Error(`Failed to persist incident (${error.code || 'unknown'})`);
    if (data) return { incident: { ...incidentFromRow(data), runtimeEnc: record.runtimeEnc || null }, created: true };
    if (record.clientRequestId) {
      const { data: existing, error: readError } = await this.db
        .from('sos_incidents')
        .select()
        .eq('user_id', record.userId)
        .eq('client_request_id', record.clientRequestId)
        .single();
      if (readError) throw new Error('Failed to read existing incident');
      return { incident: await this.attachRuntime(incidentFromRow(existing)), created: false };
    }
    throw new Error('Failed to persist incident (unknown)');
  }

  async getIncident(id) {
    const { data, error } = await this.db.from('sos_incidents').select().eq('id', id).maybeSingle();
    if (error) throw new Error('Failed to read incident');
    return incidentFromRow(data);
  }

  async updateIncident(id, patch) {
    const row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.emergencyAt !== undefined) row.emergency_at = iso(patch.emergencyAt);
    if (patch.endedAt !== undefined) row.ended_at = iso(patch.endedAt);
    if (patch.trackerRevokedAt !== undefined) row.tracker_revoked_at = iso(patch.trackerRevokedAt);
    const { data, error } = await this.db.from('sos_incidents').update(row).eq('id', id).select().maybeSingle();
    if (error) throw new Error('Failed to update incident');
    return incidentFromRow(data);
  }

  async updateIncidentLocation(id, patch) {
    const row = {};
    if (patch.location) {
      row.location_latitude = patch.location.latitude;
      row.location_longitude = patch.location.longitude;
      row.location_accuracy_m = patch.location.accuracy ?? null;
      row.location_captured_at = iso(patch.location.timestamp);
    }
    if (patch.locationStatus) row.location_status = patch.locationStatus;
    if (patch.locationUnavailableReason !== undefined) {
      row.location_unavailable_reason = patch.locationUnavailableReason;
    }
    const { data, error } = await this.db.from('sos_incidents').update(row).eq('id', id).select().maybeSingle();
    if (error) throw new Error('Failed to update incident location');
    return incidentFromRow(data);
  }

  async listRecoverableIncidents(nowMs) {
    const { data, error } = await this.db
      .from('sos_incidents')
      .select()
      .in('status', RECOVERABLE_STATUSES)
      .is('ended_at', null)
      .is('tracker_revoked_at', null);
    if (error) throw new Error('Failed to list recoverable incidents');
    const rows = (data || [])
      .map(incidentFromRow)
      .filter((incident) => incident.trackerExpiresAt == null || incident.trackerExpiresAt > nowMs);
    const withRuntime = [];
    for (const incident of rows) {
      withRuntime.push(await this.attachRuntime(incident));
    }
    return withRuntime;
  }

  async countEmergencyIncidentsSince(userId, sinceMs, excludeId) {
    let query = this.db
      .from('sos_incidents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('emergency_at', iso(sinceMs));
    if (excludeId) query = query.neq('id', excludeId);
    const { count, error } = await query;
    if (error) throw new Error('Failed to count incidents');
    return count || 0;
  }

  async claimDelivery(input) {
    const row = {
      incident_id: input.incidentId,
      user_id: input.userId,
      contact_id: input.contactId || null,
      recipient_key: input.recipientKey,
      recipient_name: input.recipientName || null,
      channel: input.channel,
      to_phone_e164: input.toPhone,
      body_sha256: input.bodySha256 || null,
      idempotency_key: `${input.incidentId}:${input.recipientKey}:${input.channel}`,
      status: 'pending',
      attempts: 0,
    };
    const { data, error } = await this.db.from('sos_alert_deliveries').insert(row).select().single();
    if (!error) return { claimed: true, delivery: deliveryFromRow(data) };
    if (error.code === UNIQUE_VIOLATION) {
      const { data: existing, error: readError } = await this.db
        .from('sos_alert_deliveries')
        .select()
        .eq('incident_id', input.incidentId)
        .eq('recipient_key', input.recipientKey)
        .eq('channel', input.channel)
        .single();
      if (readError) throw new Error('Failed to read existing delivery');
      return { claimed: false, delivery: deliveryFromRow(existing) };
    }
    throw new Error(`Failed to claim delivery (${error.code || 'unknown'})`);
  }

  async updateDelivery(id, patch) {
    const row = {};
    for (const [key, column] of Object.entries(DELIVERY_COLUMN)) {
      if (patch[key] === undefined) continue;
      row[column] = TIME_FIELDS.has(key) ? iso(patch[key]) : patch[key];
    }
    const { data, error } = await this.db.from('sos_alert_deliveries').update(row).eq('id', id).select().single();
    if (error) throw new Error('Failed to update delivery');
    return deliveryFromRow(data);
  }

  async findDeliveryBySid(sid) {
    const { data, error } = await this.db
      .from('sos_alert_deliveries')
      .select()
      .eq('provider_message_sid', sid)
      .maybeSingle();
    if (error) throw new Error('Failed to read delivery');
    return deliveryFromRow(data);
  }

  async listDeliveries(incidentId) {
    const { data, error } = await this.db
      .from('sos_alert_deliveries')
      .select()
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });
    if (error) throw new Error('Failed to list deliveries');
    return (data || []).map(deliveryFromRow);
  }

  async getDelivery(id) {
    const { data, error } = await this.db.from('sos_alert_deliveries').select().eq('id', id).maybeSingle();
    if (error) throw new Error('Failed to read delivery');
    return deliveryFromRow(data);
  }

  async acquireLease(id, leaseMs) {
    const until = new Date(Date.now() + leaseMs).toISOString();
    const { data, error } = await this.db.rpc('claim_alert_delivery_lease', {
      p_id: id,
      p_lease_until: until,
    });
    if (error) throw new Error('Failed to claim delivery lease');
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) {
      return { acquired: false, delivery: await this.getDelivery(id) };
    }
    return { acquired: true, delivery: deliveryFromRow(row) };
  }
}

module.exports = { MemoryIncidentRepository, SupabaseIncidentRepository };
