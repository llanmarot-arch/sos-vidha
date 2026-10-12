# Offline-first SOS — Phase 1 notes

What the app does today, what it deliberately does not do, and why.

## How an SOS moves

1. On confirmation the phone writes an incident record (random UUID, phone-clock time, `LOCAL_ONLY`) before any network call. GPS is captured afterwards and stored as a real fix (with its own timestamp and accuracy) or as `UNAVAILABLE` with the device's reason.
2. The record is sent to `POST /api/session/start` with `clientRequestId = incident ID` and `deviceActivatedAt`. The server keeps one incident per `(user, clientRequestId)`, so retries after timeouts, crashes or restarts do not create a second incident (`200 reused` while the live session exists, or `409 INCIDENT_EXISTS` after it is gone). A 409 is not proof that a message was delivered; the phone keeps the incident as delivery-unconfirmed unless the response includes delivery records.
3. Sync states: `LOCAL_ONLY → SYNCING → SERVER_RECEIVED`, or `WAITING_FOR_NETWORK` (retries at 5 s, 15 s, 60 s, then 5 min; 6 automatic attempts) or `SYNC_FAILED` (needs sign-in, no contacts, account mismatch, rejected, retry limit). `CLOSED` is local only.
4. Retries run only while the app is in the foreground: on launch, on return to foreground, on the browser `online` event, after sign-in, from a single timer, or when the user taps "Try sending again". **Nothing guarantees background delivery.**
5. When the server alert is late by more than 2 minutes, the SMS says so: "DELAYED ALERT: … pressed SOS on their phone at X (phone clock). It reached the SOS-Vidha server at Y." Stale GPS is described relative to when the alert was sent.

Records never contain auth tokens, disarm tokens, tracking links or phone numbers. A local record cannot disarm anything: stopping a server alert still requires the disarm token held in memory by the live session. After an app restart that token is gone, so a server-confirmed SOS can no longer be stopped from the app (see "Next phase").

Storage: iOS Keychain / Android Keystore via `expo-secure-store` (falls back to app-private AsyncStorage if a write is rejected, to avoid losing the SOS). On web: `localStorage` (no secure store exists).

## Per-recipient ledger

| Server status | Ledger status |
| --- | --- |
| (not yet synced) | `QUEUED_LOCALLY` |
| pending, dry_run, rate_limited, cancelled | `NOT_ATTEMPTED` (with reason) |
| accepted, sent | `SUBMITTED_TO_PROVIDER` (`sent` also marks carrier acceptance) |
| delivered | `DELIVERED` — only from Twilio's delivery callback |
| failed, undelivered | `FAILED` |
| sending, retrying, unconfirmed, anything unknown | `UNKNOWN` |

Device SMS (system composer) entries are always `UNKNOWN`, or `NOT_ATTEMPTED` if the user cancelled. The composer cannot confirm sending, let alone delivery.

## Alert routes

1. **Backend / Twilio SMS** — primary, implemented.
2. **Android native SMS (`SEND_SMS`)** — **not implemented, by decision.**
   - Google Play's *SMS and Call Log permissions* policy lists "Physical safety / emergency alerts to send SMS" as an eligible exception. It requires a Permissions Declaration Form and manual review, and is granted only when SMS is core functionality and no alternative exists. SOS-Vidha already sends SMS from its server, which reviewers commonly treat as an alternative; rejection is likely unless the offline case is argued and evidenced.
   - Expo SDK 52 has no first-party module that sends SMS silently. It would need a custom native module (Android `SmsManager` with sent/delivered `PendingIntent`s, dual-SIM selection, runtime permission flow), a config plugin and EAS development builds (no Expo Go).
   - Even then, "sent" means handed to the radio. Delivery reports depend on the carrier and are often missing.
   - Revisit only with: a Play policy pre-review, a native module with tests on physical dual-SIM devices, and carrier testing.
3. **iOS** — apps cannot send ordinary SMS silently. The only option is `MFMessageComposeViewController` (via `expo-sms`), where the user must press Send. Its `sent` result means "handed to Messages", not sent or delivered.
4. **Manual call to 112** — always shown, independent of the app's server.

Implemented fallback: "Text my contacts from this phone" opens the system composer (`expo-sms`, both platforms) with verified facts only: press time, real GPS fix with time/accuracy or "UNAVAILABLE", and a call-112 line. It uses no special permission. It needs contacts cached on the device (refreshed whenever Supabase loads them).

## Maps

- Native (`react-native-maps`, Apple/Google provider): no API to download or inspect offline tiles. Any map shown offline is the OS provider's opportunistic cache. The home screen states "OFFLINE MAP UNAVAILABLE" when the server is unreachable, and "No GPS fix yet" when there is no real fix.
- Web (Leaflet + `tile.openstreetmap.org`): shows "OFFLINE MAP UNAVAILABLE" when no tile loads and tiles fail. Tiles already in the browser's HTTP cache still display, because they are real content. Standard OSM tiles must not be prefetched or bundled (OSMF tile usage policy).
- Recommended offline option (next phase): **MapLibre React Native** (`@maplibre/maplibre-react-native`, needs EAS dev build) with **self-hosted vector tiles** (Protomaps PMTiles or OpenMapTiles built from OpenStreetMap data, ODbL, attribution "© OpenStreetMap contributors"), downloaded per region by explicit user choice, with size limits and expiry.

## Not claimed

Offline alerting has **not** been tested on real devices with airplane mode, real GPS, SIM and carrier conditions. Automated tests use an in-memory store and a fake server; the browser run used dry-run alerts.

## Next phase

- Owner-authorized disarm after restart (server-side re-issue of a disarm capability after re-authentication, not stored locally).
- Native `HomeScreen` monitoring sessions (`startSessionOnServer`, `DisarmModal`) still use raw `fetch` without the user's JWT, so they fail once Supabase auth is required. Move them to `apiClient`.
- Real-device test matrix: airplane mode, no GPS, SIM without data, app killed during sync, token expiry while offline.
- MapLibre offline regions (above). Optionally `@react-native-community/netinfo` for connectivity hints, which is never used as proof of reachability.
