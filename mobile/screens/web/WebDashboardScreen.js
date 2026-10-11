import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SOSHoldButton from '../../components/SOSHoldButton';
import AnomalyDashboard from '../../components/AnomalyDashboard';
import AppButton from '../../components/AppButton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { tokens, SOS_STATES } from '../../theme/tokens';
import { useSOSFlowStore } from '../../store/useSOSFlowStore';
import { useContactsStore } from '../../store/useContactsStore';
import { useSOSDispatch } from '../../hooks/useSOSDispatch';
import { isMockFallbackActive, isDevMockEnabled, apiClient } from '../../services/apiClient';
import AlertStatusPanel from '../../components/AlertStatusPanel';
import IncidentStatusPanel from '../../components/IncidentStatusPanel';

function QuickTile({ icon, label, description, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
    >
      <View style={styles.tileIcon}>
        <Feather name={icon} size={22} color={tokens.color.primary} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileDesc}>{description}</Text>
    </TouchableOpacity>
  );
}

function StatusCard({ sosState, contactCount, onAddContacts }) {
  if (sosState === SOS_STATES.ACTIVE_ALERT) {
    return (
      <View style={[styles.statusCard, styles.statusAlert]} accessibilityRole="alert">
        <Feather name="alert-triangle" size={32} color={tokens.color.onCritical} />
        <View style={styles.statusBody}>
          <Text style={styles.statusTitleLight}>SOS alert is on</Text>
          <Text style={styles.statusTextLight}>Check the alert status below to see which messages went out.</Text>
        </View>
      </View>
    );
  }
  if (contactCount < 1) {
    return (
      <View style={[styles.statusCard, styles.statusWarn]}>
        <Feather name="user-plus" size={32} color={tokens.color.warning} />
        <View style={styles.statusBody}>
          <Text style={[styles.statusTitle, { color: tokens.color.warning }]}>Add an emergency contact</Text>
          <Text style={styles.statusText}>SOS needs at least one person to alert.</Text>
          <TouchableOpacity onPress={onAddContacts} accessibilityRole="link" style={styles.inlineLink}>
            <Text style={styles.inlineLinkText}>Add contact</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.statusCard, styles.statusSafe]}>
      <Feather name="check-circle" size={32} color={tokens.color.success} />
      <View style={styles.statusBody}>
        <Text style={[styles.statusTitle, { color: tokens.color.success }]}>You are protected</Text>
        <Text style={styles.statusText}>
          {contactCount} emergency {contactCount === 1 ? 'contact is' : 'contacts are'} ready to be alerted.
        </Text>
      </View>
    </View>
  );
}

export default function WebDashboardScreen({ onNavigate }) {
  const sosState = useSOSFlowStore((s) => s.sosState);
  const countdownSeconds = useSOSFlowStore((s) => s.countdownSeconds);
  const dispatchError = useSOSFlowStore((s) => s.dispatchError);
  const followUpError = useSOSFlowStore((s) => s.followUpError);
  const deliveries = useSOSFlowStore((s) => s.deliveries);
  const alertsMode = useSOSFlowStore((s) => s.alertsMode);
  const alertLocation = useSOSFlowStore((s) => s.alertLocation);
  const alertStatusError = useSOSFlowStore((s) => s.alertStatusError);
  const localIncidentId = useSOSFlowStore((s) => s.localIncidentId);
  const contacts = useContactsStore((s) => s.contacts);
  const contactsError = useContactsStore((s) => s.error);
  const contactsCachedAt = useContactsStore((s) => s.cachedAt);
  const { beginCountdown, abortCountdown, cancelAlert } = useSOSDispatch();
  const [apiStatus, setApiStatus] = useState('CHECKING');
  const [confirmSos, setConfirmSos] = useState(false);

  useEffect(() => {
    apiClient
      .healthCheck()
      .then(() => setApiStatus(isMockFallbackActive() ? 'DEV_MOCK' : 'ONLINE'))
      .catch(() => setApiStatus('OFFLINE'));
  }, [sosState]);

  // Only block SOS when contacts are known to be empty; if they could not be loaded the server still decides.
  const sosDisabled = contacts.length < 1 && !contactsError;
  const callEmergency = () => Linking.openURL('tel:112');

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.srOnlyHeading} accessibilityRole="header" aria-level={1}>
          Home
        </Text>

        <StatusCard sosState={sosState} contactCount={contacts.length} onAddContacts={() => onNavigate('contacts')} />

        {apiStatus === 'DEV_MOCK' && isDevMockEnabled() ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>Test mode is on. Alerts are simulated and nobody will be contacted.</Text>
          </View>
        ) : null}

        {apiStatus === 'OFFLINE' ? (
          <View style={styles.warnBanner} accessibilityRole="alert">
            <Text style={styles.warnTitle}>Can't reach the SOS server</Text>
            <Text style={styles.warnText}>
              If you press SOS now it is saved on this device and sent when the connection returns. Nobody is alerted
              until then. If you're in danger, call 112 directly.
            </Text>
          </View>
        ) : null}

        {contactsCachedAt ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              Showing the contacts saved on this device. They could not be refreshed from your account.
            </Text>
          </View>
        ) : null}

        {dispatchError ? (
          <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Text style={styles.errorTitle}>SOS alert was not sent</Text>
            <Text style={styles.errorText}>{dispatchError}</Text>
          </View>
        ) : null}

        <IncidentStatusPanel hideIncidentId={sosState === SOS_STATES.ACTIVE_ALERT ? localIncidentId : null} />

        {sosState === SOS_STATES.ACTIVE_ALERT ? (
          <AlertStatusPanel
            deliveries={deliveries}
            alertsMode={alertsMode}
            alertLocation={alertLocation}
            followUpError={followUpError}
            alertStatusError={alertStatusError}
          />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header" aria-level={2}>
            Emergency SOS
          </Text>
          <Text style={styles.cardText}>
            Press and hold the red button for about 2 seconds. You will then have 3 seconds to cancel before your
            contacts are alerted.
          </Text>

          <View style={styles.sosSection}>
            <SOSHoldButton
              sosState={sosState}
              disabled={sosDisabled}
              loading={sosState === SOS_STATES.DISPATCHING}
              onHoldStart={() => useSOSFlowStore.getState().transition(SOS_STATES.HOLDING)}
              onHoldEnd={() => {
                if (useSOSFlowStore.getState().sosState === SOS_STATES.HOLDING) {
                  useSOSFlowStore.getState().reset();
                }
              }}
              onHoldComplete={beginCountdown}
            />
          </View>

          {sosState === SOS_STATES.COUNTDOWN ? (
            <View style={styles.countdownCard} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              <Text style={styles.countdownLabel}>Sending SOS in</Text>
              <Text style={styles.countdownValue}>{countdownSeconds} seconds</Text>
              <AppButton label="Cancel SOS" variant="ghost" onPress={abortCountdown} />
            </View>
          ) : null}

          {sosState === SOS_STATES.ACTIVE_ALERT ? (
            <AppButton label="Stop SOS alert" variant="ghost" onPress={cancelAlert} />
          ) : null}

          {sosState === SOS_STATES.IDLE ? (
            <AppButton
              label="Send SOS without holding"
              variant="ghost"
              disabled={sosDisabled}
              onPress={() => setConfirmSos(true)}
              accessibilityHint="For keyboard and screen reader users. Asks you to confirm before starting the countdown."
            />
          ) : null}

          <View style={styles.divider} />
          <AppButton
            label="Call 112 (emergency services)"
            variant="critical"
            onPress={callEmergency}
            icon={<Feather name="phone-call" size={18} color={tokens.color.onCritical} />}
            accessibilityHint="Opens your phone dialer. The app does not place this call automatically."
          />
        </View>

        <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>
          Quick actions
        </Text>
        <View style={styles.tileGrid}>
          <QuickTile icon="map-pin" label="Share location" description="Send your live location" onPress={() => onNavigate('live')} />
          <QuickTile icon="users" label="Nearby help" description="People close to you" onPress={() => onNavigate('sentinel')} />
          <QuickTile icon="phone" label="Contacts" description="Who gets your alerts" onPress={() => onNavigate('contacts')} />
          <QuickTile icon="settings" label="Settings" description="Triggers and alerts" onPress={() => onNavigate('settings')} />
        </View>

        <AnomalyDashboard onAutoTrigger={beginCountdown} />
      </ScrollView>

      <ConfirmDialog
        visible={confirmSos}
        title="Send SOS alert?"
        message="A 3-second countdown will start. Your emergency contacts will be alerted unless you cancel."
        confirmLabel="Yes, send SOS"
        cancelLabel="No, go back"
        destructive
        onConfirm={() => {
          setConfirmSos(false);
          beginCountdown();
        }}
        onCancel={() => setConfirmSos(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 40, gap: tokens.spacing.md },
  srOnlyHeading: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
  },
  statusSafe: { backgroundColor: tokens.color.successSoft, borderWidth: 1, borderColor: '#BFE3CB' },
  statusWarn: { backgroundColor: tokens.color.warningSoft, borderWidth: 1, borderColor: '#F2D49B' },
  statusAlert: { backgroundColor: tokens.color.criticalFill },
  statusBody: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 20, fontWeight: '700' },
  statusText: { fontSize: 16, color: tokens.color.text, lineHeight: 22 },
  statusTitleLight: { fontSize: 20, fontWeight: '700', color: tokens.color.onCritical },
  statusTextLight: { fontSize: 16, color: tokens.color.onCritical, lineHeight: 22 },
  inlineLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  inlineLinkText: { color: tokens.color.primary, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
  infoBanner: {
    backgroundColor: tokens.color.primarySoft,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.primary,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
  },
  infoText: { color: tokens.color.text, fontSize: 15, lineHeight: 22 },
  warnBanner: {
    backgroundColor: tokens.color.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.warning,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: 4,
  },
  warnTitle: { color: tokens.color.warning, fontWeight: '700', fontSize: 16 },
  warnText: { color: tokens.color.text, fontSize: 15, lineHeight: 22 },
  errorBanner: {
    backgroundColor: tokens.color.criticalSoft,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.critical,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: 4,
  },
  errorTitle: { color: tokens.color.critical, fontWeight: '700', fontSize: 16 },
  errorText: { color: tokens.color.text, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: tokens.spacing.md,
  },
  cardTitle: { ...tokens.typography.title, color: tokens.color.text },
  cardText: { fontSize: 16, lineHeight: 24, color: tokens.color.textMuted },
  sosSection: { alignItems: 'center', marginVertical: tokens.spacing.sm },
  countdownCard: {
    alignItems: 'center',
    backgroundColor: tokens.color.criticalSoft,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  countdownLabel: { color: tokens.color.critical, fontWeight: '700', fontSize: 16 },
  countdownValue: { color: tokens.color.critical, fontSize: 36, fontWeight: '800' },
  divider: { height: 1, backgroundColor: tokens.color.border },
  sectionLabel: { ...tokens.typography.title, color: tokens.color.text, marginTop: tokens.spacing.sm },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  tile: {
    width: '48.5%',
    minHeight: 120,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: 6,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { color: tokens.color.text, fontWeight: '700', fontSize: 16 },
  tileDesc: { color: tokens.color.textSubtle, fontSize: 14, lineHeight: 20 },
});
