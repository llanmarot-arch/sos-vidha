-- Durable incident runtime and notification-outbox leases.
-- Additive only: no existing rows are deleted or rewritten.
--
-- sos_incident_runtime holds an AES-256-GCM blob (tracker capability, disarm capability,
-- PIN hashes, recipient snapshot). It does not hold the SMS body. Service role only.
-- Recommended retention is 30 days after the incident ends. Deletion is not automatic.
--
-- sos_alert_deliveries.lease_until lets one worker claim an unsent row.
-- idempotency_key repeats the (incident, recipient, channel) key on new rows.
-- A row left in "sending" without a provider id is ambiguous: recovery may adopt a
-- provider record, otherwise it stays unconfirmed and is not sent again.
-- Twilio does not guarantee exactly-once delivery.

create table if not exists public.sos_incident_runtime (
  incident_id uuid primary key references public.sos_incidents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  runtime_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sos_incident_runtime enable row level security;

revoke all on table public.sos_incident_runtime from public, anon, authenticated;

drop trigger if exists sos_incident_runtime_set_updated_at on public.sos_incident_runtime;
create trigger sos_incident_runtime_set_updated_at
  before update on public.sos_incident_runtime
  for each row execute function public.set_updated_at();

comment on table public.sos_incident_runtime is
  'Encrypted incident capabilities for restart recovery. No client policies. Retain 30 days after the incident ends; deletion is not automatic.';

alter table public.sos_alert_deliveries
  add column if not exists lease_until timestamptz,
  add column if not exists idempotency_key text;

create unique index if not exists sos_alert_deliveries_idempotency_key_idx
  on public.sos_alert_deliveries (idempotency_key)
  where idempotency_key is not null;

create index if not exists sos_incidents_recoverable_idx
  on public.sos_incidents (status)
  where ended_at is null and tracker_revoked_at is null;

-- Incident row and encrypted runtime commit together. A unique client request returns null
-- so the caller can read the existing incident instead of inserting a second one.
create or replace function public.persist_sos_incident(p_incident jsonb, p_runtime_enc text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.sos_incidents;
begin
  insert into public.sos_incidents (
    id, user_id, client_request_id, status, mode, activated_at, device_activated_at,
    emergency_at, location_latitude, location_longitude, location_accuracy_m, location_captured_at,
    location_status, location_unavailable_reason, safe_zone_latitude, safe_zone_longitude,
    safe_zone_radius_m, distance_from_safe_zone_m, tracker_token_sha256, tracker_expires_at
  ) values (
    (p_incident->>'id')::uuid,
    (p_incident->>'user_id')::uuid,
    p_incident->>'client_request_id',
    p_incident->>'status',
    p_incident->>'mode',
    (p_incident->>'activated_at')::timestamptz,
    (p_incident->>'device_activated_at')::timestamptz,
    (p_incident->>'emergency_at')::timestamptz,
    (p_incident->>'location_latitude')::double precision,
    (p_incident->>'location_longitude')::double precision,
    (p_incident->>'location_accuracy_m')::double precision,
    (p_incident->>'location_captured_at')::timestamptz,
    p_incident->>'location_status',
    p_incident->>'location_unavailable_reason',
    (p_incident->>'safe_zone_latitude')::double precision,
    (p_incident->>'safe_zone_longitude')::double precision,
    (p_incident->>'safe_zone_radius_m')::integer,
    (p_incident->>'distance_from_safe_zone_m')::double precision,
    p_incident->>'tracker_token_sha256',
    (p_incident->>'tracker_expires_at')::timestamptz
  )
  returning * into inserted;

  if p_runtime_enc is not null and length(p_runtime_enc) > 0 then
    insert into public.sos_incident_runtime (incident_id, user_id, runtime_enc)
    values (inserted.id, inserted.user_id, p_runtime_enc);
  end if;

  return to_jsonb(inserted);
exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.persist_sos_incident(jsonb, text) from public, anon, authenticated;
grant execute on function public.persist_sos_incident(jsonb, text) to service_role;

-- One worker wins. The row stays pending or retrying until the dispatcher marks it sending.
create or replace function public.claim_alert_delivery_lease(p_id uuid, p_lease_until timestamptz)
returns public.sos_alert_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.sos_alert_deliveries;
begin
  update public.sos_alert_deliveries
  set lease_until = p_lease_until
  where id = p_id
    and provider_message_sid is null
    and status in ('pending', 'retrying')
    and (lease_until is null or lease_until < now())
  returning * into claimed;
  return claimed;
end;
$$;

revoke all on function public.claim_alert_delivery_lease(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_alert_delivery_lease(uuid, timestamptz) to service_role;
