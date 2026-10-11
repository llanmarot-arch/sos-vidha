-- Offline-first SOS: the phone records when SOS was pressed and may upload it later.
-- activated_at stays the server-recorded time; device_activated_at is the phone clock (untrusted, validated
-- by the backend to be at most 2 minutes ahead of and 7 days behind server time).

alter table public.sos_incidents
  add column if not exists device_activated_at timestamptz;

comment on column public.sos_incidents.device_activated_at is
  'Phone-clock time when SOS was pressed (may precede activated_at when the phone was offline).';
