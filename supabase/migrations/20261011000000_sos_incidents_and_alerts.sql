-- SOS-Vidha: persisted SOS incidents, per-recipient alert deliveries, and optional safety zone.
-- Requires 20260311000000_profiles_and_emergency_contacts.sql.
-- Rows are written only by the backend (service role). Users can read their own rows.

-- Optional safety zone. All three columns must be set together, or none.
alter table public.profiles add column if not exists safe_zone_latitude double precision;
alter table public.profiles add column if not exists safe_zone_longitude double precision;
alter table public.profiles add column if not exists safe_zone_radius_m integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_safe_zone_complete_check') then
    alter table public.profiles add constraint profiles_safe_zone_complete_check check (
      (safe_zone_latitude is null and safe_zone_longitude is null and safe_zone_radius_m is null)
      or (
        safe_zone_latitude between -90 and 90
        and safe_zone_longitude between -180 and 180
        and safe_zone_radius_m between 25 and 50000
      )
    );
  end if;
end $$;

create table if not exists public.sos_incidents (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_request_id text,
  status text not null check (status in ('ACTIVE', 'EMERGENCY', 'DURESS_ACTIVE', 'DISARMED')),
  mode text not null check (mode in ('GEOFENCE', 'TRANSIT')),
  activated_at timestamptz not null,
  emergency_at timestamptz,
  ended_at timestamptz,
  location_latitude double precision check (location_latitude between -90 and 90),
  location_longitude double precision check (location_longitude between -180 and 180),
  location_accuracy_m double precision check (location_accuracy_m >= 0),
  location_captured_at timestamptz,
  location_status text not null check (location_status in ('FRESH', 'STALE', 'LOW_ACCURACY', 'UNAVAILABLE')),
  location_unavailable_reason text,
  safe_zone_latitude double precision,
  safe_zone_longitude double precision,
  safe_zone_radius_m integer,
  distance_from_safe_zone_m double precision,
  -- Only a SHA-256 hash of the tracking capability is stored; the raw token never touches the database.
  tracker_token_sha256 text not null,
  tracker_expires_at timestamptz not null,
  tracker_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_incidents_client_request_unique unique (user_id, client_request_id)
);

create index if not exists sos_incidents_user_emergency_idx on public.sos_incidents (user_id, emergency_at);

create table if not exists public.sos_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.sos_incidents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.emergency_contacts (id) on delete set null,
  recipient_key text not null,
  recipient_name text,
  channel text not null check (channel in ('sms', 'voice', 'whatsapp')),
  to_phone_e164 text not null check (to_phone_e164 ~ '^\+?[1-9]\d{7,14}$'),
  status text not null check (
    status in (
      'pending', 'sending', 'retrying', 'accepted', 'sent', 'delivered',
      'undelivered', 'failed', 'unconfirmed', 'dry_run', 'rate_limited', 'cancelled'
    )
  ),
  attempts integer not null default 0,
  provider_message_sid text unique,
  provider_status text,
  provider_error_code text,
  -- Hash of the message body for duplicate reconciliation; the body itself (which contains the
  -- tracking capability) is never stored.
  body_sha256 text,
  last_attempt_at timestamptz,
  accepted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sos_alert_deliveries_once unique (incident_id, recipient_key, channel)
);

create index if not exists sos_alert_deliveries_incident_idx on public.sos_alert_deliveries (incident_id);

alter table public.sos_incidents enable row level security;
alter table public.sos_alert_deliveries enable row level security;

drop policy if exists "sos_incidents_select_own" on public.sos_incidents;
create policy "sos_incidents_select_own"
  on public.sos_incidents for select
  using (auth.uid() = user_id);

drop policy if exists "sos_alert_deliveries_select_own" on public.sos_alert_deliveries;
create policy "sos_alert_deliveries_select_own"
  on public.sos_alert_deliveries for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: clients cannot create, alter or forge incidents or delivery status.

drop trigger if exists sos_incidents_set_updated_at on public.sos_incidents;
create trigger sos_incidents_set_updated_at
  before update on public.sos_incidents
  for each row execute function public.set_updated_at();

drop trigger if exists sos_alert_deliveries_set_updated_at on public.sos_alert_deliveries;
create trigger sos_alert_deliveries_set_updated_at
  before update on public.sos_alert_deliveries
  for each row execute function public.set_updated_at();
