# Supabase setup for SOS-Vidha

## 1. Create project

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Email** auth provider.
3. Configure **Site URL** and redirect URLs for password reset (your Netlify domain and `http://localhost:8081` for local web).

## 2. Run migrations (in order)

Apply these in the Supabase SQL editor (or via Supabase CLI):

1. `migrations/20260311000000_profiles_and_emergency_contacts.sql`
   - `profiles` (linked to `auth.users`)
   - `emergency_contacts`
   - Row-level security policies (users can only access their own rows)
   - Trigger to create a profile row on signup
2. `migrations/20261011000000_sos_incidents_and_alerts.sql`
   - Optional safety zone on `profiles` (`safe_zone_latitude`, `safe_zone_longitude`, `safe_zone_radius_m`; all three or none)
   - `sos_incidents`: one row per SOS, unique per `(user_id, client_request_id)` so retries never create duplicates. Stores only a SHA-256 hash of the tracking capability.
   - `sos_alert_deliveries`: one row per incident/contact/channel with provider status. Message bodies are not stored, only their hash.
   - RLS: users can read their own incidents and deliveries; only the backend (service role) writes.
3. `migrations/20261012000000_incident_device_activated_at.sql`
   - `sos_incidents.device_activated_at`: phone-clock time SOS was pressed, for incidents saved offline and sent later. **Required before deploying the offline-first backend**; without it, incident inserts fail and SOS returns `INCIDENT_NOT_PERSISTED`.

There is no app screen for the safety zone yet. To configure one for a user:

```sql
update public.profiles
set safe_zone_latitude = 28.6129, safe_zone_longitude = 77.2295, safe_zone_radius_m = 500
where id = '<user uuid>';
```

If no zone is set, alerts say nothing about a zone.

## 3. Environment variables

**Mobile / Expo** (public):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Backend** (server only — never commit real values):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

When these are set on the backend, `POST /api/session/start` and `POST /api/session/disarm` require a valid Supabase access token and enforce guardian contact ownership.

## 4. Verification checklist

- [ ] Email verification enabled and test signup completes
- [ ] Profile row appears after registration
- [ ] Emergency contacts CRUD works only for signed-in user
- [ ] Second user cannot read first user's contacts (RLS)
- [ ] SOS session start fails without auth when Supabase is configured on backend
- [ ] Disarm uses server-issued token (not client-invented values)

Until this checklist passes with real credentials, treat the account system as **not production-verified**.

## Live tracking links (guardian capability)

Guardian tracking URLs include a server-issued capability token (`?t=...`) separate from the session ID and owner JWT. Anyone with an **active** tracking link can view that session's live location (read-only) until the SOS is stopped or the link expires (`TRACKER_TOKEN_TTL_MS`, default 12 hours). Do not share tracking links publicly. Capability values must not be logged.

## Emergency SMS verification checklist (controlled test)

Use test phones you own, `SMS_LIVE_SEND=true`, and an https `PUBLIC_SERVER_URL` (for delivery callbacks).

- [ ] SOS from user A texts only user A's saved contacts
- [ ] SMS shows the profile name, server activation time, GPS fix time and accuracy (or "UNAVAILABLE"/"STALE")
- [ ] Tracking link opens; it stops working after "Stop SOS alert"
- [ ] App shows "Queued", then "Sent", then "Delivered" only as Twilio reports each status
- [ ] Repeating the same request does not send a second SMS
- [ ] User B cannot read user A's incident (`/api/session/:id`, `/api/session/:id/alerts`)
