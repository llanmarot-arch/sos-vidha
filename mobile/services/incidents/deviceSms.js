import { Platform } from 'react-native';
import * as SMS from 'expo-sms';

/**
 * Opens the phone's own Messages composer. This does not send an SMS by itself.
 *
 * Android (expo-sms 13 / SDK 52): ACTION_SENDTO into the default SMS app. No SEND_SMS permission.
 * The module always resolves `unknown` when the app resumes, because reading the result would need READ_SMS.
 * `isAvailableAsync` is only "this device has telephony hardware", not "a SIM can send right now".
 *
 * iOS: MFMessageComposeViewController. The user must tap Send. `sent` means Messages accepted the
 * handoff, not that a carrier delivered it. `canSendText()` is false on devices without SMS (most iPads).
 */

function unavailable(message) {
  const err = new Error(message);
  err.code = 'SMS_UNAVAILABLE';
  return err;
}

export async function isDeviceSmsAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    return await SMS.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Returns 'sent' | 'cancelled' | 'failed' | 'unknown'.
 * Throws SMS_UNAVAILABLE when Messages cannot be opened. Never logs numbers or the message body.
 */
export async function composeDeviceSms(phones, body) {
  const recipients = (phones || []).filter((p) => typeof p === 'string' && p.trim());
  if (!recipients.length) throw unavailable('No phone numbers saved on this device');
  if (!(await isDeviceSmsAvailable())) {
    throw unavailable('This phone cannot open Messages for SMS.');
  }
  try {
    const { result } = await SMS.sendSMSAsync(recipients, body);
    if (result === 'sent' || result === 'cancelled') return result;
    return 'unknown';
  } catch (err) {
    const msg = String(err?.message || '');
    if (/unsuccessful|sending failed/i.test(msg)) {
      const failed = new Error('The phone reported the text could not be sent.');
      failed.code = 'SMS_FAILED';
      throw failed;
    }
    throw unavailable('Messages could not be opened on this phone.');
  }
}
