# Offline-first SOS — Phase 2: on-device SMS

Phase 1 already queues the incident and sends it through the authenticated backend. This phase adds only the on-device route that Expo SDK 52 can do without a restricted permission.

## Decision: no direct Android SMS

Direct sending (`SmsManager`, permission `SEND_SMS`) is **not implemented**.

Google Play’s [Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820) (and the [July 2026 preview](https://support.google.com/googleplay/android-developer/answer/17225965)) allows `SEND_SMS` for a non-default SMS app only as a **temporary, declared exception**: the permission must be core functionality and there must be **no alternative**. “Physical safety / emergency alerts to send SMS” is one listed case. It is not automatic. It needs a Play Console Permissions Declaration, and review is case by case.

SOS-Vidha does not qualify for that exception today:

- The server already sends SMS through Twilio whenever the phone can reach it.
- `expo-sms` 13 (SDK 52) already opens the system composer with no special permission. That is the alternative Play expects apps to use.
- Reading whether the user pressed send would require `READ_SMS`, which is in the same restricted group. `expo-sms` refuses to do that.

A compliant direct-send build would also be a custom native module (not in Expo Go), an EAS development build, runtime permission UI, dual-SIM selection, and sent/delivered `PendingIntent`s. “Sent” there still means the radio accepted the message. Delivery depends on the carrier and is often unreported. None of that is added here.

`app.json` does not request `SEND_SMS` or `READ_SMS`.

## What the phone can do

| Platform | API in this project | What it proves |
| --- | --- | --- |
| Android | `expo-sms` `ACTION_SENDTO` into the default SMS app | Messages was opened. The module **always** returns `unknown` when the app resumes. `isAvailableAsync` means the device has telephony hardware, not that a SIM can send. No default SMS app throws before opening. |
| iOS | `MFMessageComposeViewController` | The user must tap Send. `sent` means Messages accepted the handoff. `cancelled` means they closed it. `failed` means the phone reported the attempt failed. `canSendText()` is false on devices without SMS. |
| Web | none | The button is hidden. |

The composer is opened only after the user confirms. If a previous attempt is `UNKNOWN`, a second confirm says a copy may already have been sent. Nothing sends automatically, and a repeat does not add a second ledger row per contact.

Ledger stages for this route (status is never `DELIVERED` or `SUBMITTED_TO_PROVIDER`):

| Composer result | Status | Stage |
| --- | --- | --- |
| `cancelled` | `NOT_ATTEMPTED` | `composer_closed` |
| `unknown` (Android always) | `UNKNOWN` | `composer_opened` |
| `sent` (iOS handoff only) | `UNKNOWN` | `handed_to_messages` |
| `failed` | `FAILED` | `composer_failed` |

The message is built from the incident record: phone-clock press time, real GPS fix with its timestamp and accuracy, or an explicit unavailable line. A tracking link is added only when the live session still holds a backend URL of the form `/track/<incident-id>?t=<64-hex capability>` for **this** incident. A session id alone is rejected. The link is not written into the stored incident.

Call 112 stays a separate action.

## Not tested on hardware

Automated tests do not send SMS. Still required on physical devices, with test contacts only:

- Android, mobile data off, cellular and an SMS-capable SIM: composer opens, user sends, app stays on `UNKNOWN`.
- Android with no cellular service, no SIM, no default SMS app, and permission-less denial (there is no `SEND_SMS` prompt).
- iOS: cancel, user taps Send, and a device where `canSendText()` is false.
- Composer while GPS is missing or stale.
- Airplane mode (no data and no cellular): incident stays queued, composer cannot send, call 112 still opens the dialer.
- Duplicate taps and an app restart: one incident, no second automatic text.
- Another user still cannot read the incident or its tracking link (covered by the existing backend tests).

## Next

- Play Console pre-review only if product decides silent offline SMS is required despite the server and composer alternatives. Do not add the permission before that review.
- Owner-authorized stop-after-restart, and moving native monitoring onto the authenticated API client.
