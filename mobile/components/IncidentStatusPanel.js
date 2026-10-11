import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import AppButton from './AppButton';
import ConfirmDialog from './ConfirmDialog';
import { tokens } from '../theme/tokens';
import { useIncidentStore, selectFeaturedIncident } from '../store/useIncidentStore';
import { useContactsStore } from '../store/useContactsStore';
import { useProfileStore } from '../store/useProfileStore';
import {
  SYNC_STATUS,
  RECIPIENT_STATUS,
  ROUTE,
  describeIncident,
  describeIncidentLocation,
  describeComposerResult,
  buildDeviceSmsBody,
  deviceSmsOffer,
  trackingUrlForIncident,
  isUnsent,
} from '../services/incidents/incidentModel';
import { isDeviceSmsAvailable, composeDeviceSms } from '../services/incidents/deviceSms';
import { useSOSFlowStore } from '../store/useSOSFlowStore';

const TONE_COLOR = {
  success: tokens.color.success,
  warning: tokens.color.warning,
  critical: tokens.color.critical,
  neutral: tokens.color.textMuted,
};

const RECIPIENT_LABEL = {
  [RECIPIENT_STATUS.NOT_ATTEMPTED]: ['Not sent', 'warning'],
  [RECIPIENT_STATUS.QUEUED_LOCALLY]: ['Queued on this phone — not sent', 'warning'],
  [RECIPIENT_STATUS.SUBMITTED_TO_PROVIDER]: ['Submitted — delivery not confirmed', 'warning'],
  [RECIPIENT_STATUS.DELIVERED]: ['Delivered', 'success'],
  [RECIPIENT_STATUS.FAILED]: ['Failed', 'critical'],
  [RECIPIENT_STATUS.UNKNOWN]: ['Unknown', 'warning'],
};

function LedgerRow({ entry, dark }) {
  const [label, tone] = RECIPIENT_LABEL[entry.status] || RECIPIENT_LABEL[RECIPIENT_STATUS.UNKNOWN];
  const route = entry.route === ROUTE.DEVICE_SMS ? 'Text from your phone' : 'SMS from SOS-Vidha server';
  return (
    <View style={[styles.row, dark && styles.rowDark]} role="listitem">
      <Text style={[styles.rowName, dark && styles.textDark]}>
        {route} to {entry.recipientName || entry.to || 'contact'}
      </Text>
      <Text style={[styles.rowStatus, { color: TONE_COLOR[tone] }]}>{label}</Text>
      {entry.detail ? <Text style={[styles.subtle, dark && styles.subtleDark]}>{entry.detail}</Text> : null}
      {entry.providerMessageId ? (
        <Text style={[styles.subtle, dark && styles.subtleDark]}>Provider ref …{entry.providerMessageId.slice(-6)}</Text>
      ) : null}
    </View>
  );
}

/**
 * Honest status for an SOS saved on this phone. Hidden while the live alert panel already shows the same incident.
 * `hideIncidentId` lets the caller suppress the incident that is currently live.
 */
export default function IncidentStatusPanel({ hideIncidentId = null, dark = false }) {
  const incidents = useIncidentStore((s) => s.incidents);
  const contacts = useContactsStore((s) => s.contacts);
  const profileName = useProfileStore((s) => s.profile?.full_name || null);
  const liveSessionId = useSOSFlowStore((s) => s.sessionId);
  const liveLocalId = useSOSFlowStore((s) => s.localIncidentId);
  const liveTrackingUrl = useSOSFlowStore((s) => s.trackingUrl);
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    isDeviceSmsAvailable().then(setSmsAvailable);
  }, []);

  const record = selectFeaturedIncident(incidents);
  const offer = record ? deviceSmsOffer(record) : { show: false, duplicateRisk: false };
  const phones = contacts.map((c) => c.phone).filter(Boolean);
  const showComposer = offer.show && smsAvailable && phones.length;
  const suppressed = Boolean(record && record.id === hideIncidentId);
  if (!record || (suppressed && !showComposer)) return null;

  const summary = describeIncident(record);
  const unsent = isUnsent(record);
  const syncing = record.status === SYNC_STATUS.SYNCING;
  const received = record.status === SYNC_STATUS.SERVER_RECEIVED;

  const run = async (fn) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const textFromPhone = () =>
    run(async () => {
      const trackingUrl = trackingUrlForIncident(record, {
        sessionId: liveSessionId,
        localIncidentId: liveLocalId,
        trackingUrl: liveTrackingUrl,
      });
      const body = buildDeviceSmsBody(record, { profileName, nowMs: Date.now(), trackingUrl });
      try {
        const result = await composeDeviceSms(phones, body);
        await useIncidentStore.getState().recordDeviceSms(record.id, contacts, result);
        setNote(describeComposerResult(result));
      } catch (err) {
        if (err?.code === 'SMS_FAILED') {
          await useIncidentStore.getState().recordDeviceSms(record.id, contacts, 'failed');
          setNote(describeComposerResult('failed'));
          return;
        }
        setNote('Messages could not be opened. No text was sent from this phone. Call your contacts or 112.');
      }
    });

  return (
    <View
      style={[styles.card, dark && styles.cardDark, { borderLeftColor: TONE_COLOR[summary.tone] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {suppressed ? (
        <>
          <Text style={[styles.title, { color: TONE_COLOR.warning }]} accessibilityRole="header" aria-level={2}>
            Text from this phone
          </Text>
          <Text style={[styles.text, dark && styles.textDark]}>
            The server has not confirmed that a text was sent. You can send one yourself. You must press send.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: TONE_COLOR[summary.tone] }]} accessibilityRole="header" aria-level={2}>
            {summary.title}
          </Text>
          <Text style={[styles.text, dark && styles.textDark]}>{summary.text}</Text>
          <Text style={[styles.text, dark && styles.textDark]}>
            {describeIncidentLocation(record, { nowMs: Date.now() })}
          </Text>
          {record.ledger?.length ? (
            <View role="list" aria-label="Alert status for each contact">
              {record.ledger.map((entry) => (
                <LedgerRow key={entry.key} entry={entry} dark={dark} />
              ))}
            </View>
          ) : null}
        </>
      )}

      {note ? <Text style={[styles.text, dark && styles.textDark]}>{note}</Text> : null}

      {unsent && !syncing && !suppressed ? (
        <AppButton
          label="Try sending again"
          variant="primary"
          disabled={busy}
          onPress={() => run(() => useIncidentStore.getState().retry(record.id))}
        />
      ) : null}

      {showComposer ? (
        <>
          <AppButton
            label={offer.duplicateRisk ? 'Text my contacts again' : 'Text my contacts from this phone'}
            variant="ghost"
            disabled={busy}
            onPress={() => setDialog(offer.duplicateRisk ? 'sms-again' : 'sms')}
          />
          <Text style={[styles.subtle, dark && styles.subtleDark]}>
            Opens your Messages app. You must press send. Opening it does not mean the text was sent or delivered.
            Needs a SIM and mobile signal. This app cannot send the text by itself.
          </Text>
        </>
      ) : null}

      {received && !suppressed ? (
        <AppButton
          label="Refresh message status"
          variant="ghost"
          disabled={busy}
          onPress={() => run(() => useIncidentStore.getState().refreshDeliveries(record.id))}
        />
      ) : null}

      {suppressed ? null : (
        <AppButton
          label="Call 112 (emergency services)"
          variant="critical"
          onPress={() => Linking.openURL('tel:112')}
          accessibilityHint="Opens your phone dialer. Works without SOS-Vidha's server."
        />
      )}

      {!syncing && !suppressed ? (
        <AppButton label="Close on this phone" variant="ghost" disabled={busy} onPress={() => setDialog('close')} />
      ) : null}

      <ConfirmDialog
        visible={dialog === 'sms' || dialog === 'sms-again'}
        title={dialog === 'sms-again' ? 'Send another text?' : 'Open Messages?'}
        message={
          dialog === 'sms-again'
            ? 'A previous text may already have been sent. SOS-Vidha cannot check that. Open Messages again only if you want to send another copy. You still have to press send.'
            : 'This opens your Messages app with the SOS details filled in. Nothing is sent until you press send. SOS-Vidha cannot confirm sending or delivery.'
        }
        confirmLabel="Open Messages"
        cancelLabel="Don't text"
        onConfirm={() => {
          setDialog(null);
          textFromPhone();
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'close'}
        title="Close this SOS on this phone?"
        message={
          received
            ? 'This only hides it on this phone. It does not stop alerts the server already sent or cancel the live session.'
            : 'The app will stop trying to send this SOS. If an earlier attempt reached the server, contacts may still have been alerted.'
        }
        confirmLabel="Close it"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          setDialog(null);
          run(() => useIncidentStore.getState().close(record.id, 'USER_CLOSED'));
        }}
        onCancel={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderLeftWidth: 4,
    gap: tokens.spacing.sm,
  },
  cardDark: { backgroundColor: '#1E293B', borderColor: '#334155', marginTop: 12 },
  title: { ...tokens.typography.title },
  text: { fontSize: 16, lineHeight: 22, color: tokens.color.text },
  textDark: { color: '#F8FAFC' },
  subtle: { fontSize: 14, lineHeight: 20, color: tokens.color.textSubtle },
  subtleDark: { color: '#94A3B8' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.color.border, gap: 2 },
  rowDark: { borderBottomColor: '#334155' },
  rowName: { fontSize: 16, fontWeight: '700', color: tokens.color.text },
  rowStatus: { fontSize: 15, lineHeight: 21 },
});
