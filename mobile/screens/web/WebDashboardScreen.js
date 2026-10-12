import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SOSHoldButton from '../../components/SOSHoldButton';
import AppButton from '../../components/AppButton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SOS_STATES } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useTheme';
import { useSOSFlowStore } from '../../store/useSOSFlowStore';
import { useContactsStore } from '../../store/useContactsStore';
import { useSOSDispatch } from '../../hooks/useSOSDispatch';
import { isMockFallbackActive, isDevMockEnabled, apiClient } from '../../services/apiClient';
import AlertStatusPanel from '../../components/AlertStatusPanel';
import IncidentStatusPanel from '../../components/IncidentStatusPanel';
import { useI18n } from '../../i18n/useI18n';

function QuickTile({ icon, label, description, onPress }) {
  const { theme, styles } = useThemedStyles(createStyles);
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
        <Feather name={icon} size={22} color={theme.color.accentOnSurface} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileDesc}>{description}</Text>
    </TouchableOpacity>
  );
}

function StatusCard({ sosState, contactCount, onAddContacts }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
  if (sosState === SOS_STATES.ACTIVE_ALERT) {
    return (
      <View style={[styles.statusCard, styles.statusAlert]} accessibilityRole="alert">
        <Feather name="alert-triangle" size={32} color={theme.color.onCritical} />
        <View style={styles.statusBody}>
          <Text style={styles.statusTitleLight}>{t('status.sosOn')}</Text>
          <Text style={styles.statusTextLight}>{t('status.sosOnDetail')}</Text>
        </View>
      </View>
    );
  }
  if (contactCount < 1) {
    return (
      <View style={[styles.statusCard, styles.statusWarn]}>
        <Feather name="user-plus" size={32} color={theme.color.warning} />
        <View style={styles.statusBody}>
          <Text style={[styles.statusTitle, { color: theme.color.warning }]}>{t('status.addContact')}</Text>
          <Text style={styles.statusText}>{t('status.needContact')}</Text>
          <TouchableOpacity onPress={onAddContacts} accessibilityRole="link" style={styles.inlineLink}>
            <Text style={styles.inlineLinkText}>{t('status.addContactLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.statusCard, styles.statusSafe]}>
      <Feather name="check-circle" size={32} color={theme.color.success} />
      <View style={styles.statusBody}>
        <Text style={[styles.statusTitle, { color: theme.color.success }]}>{t('status.protected')}</Text>
        <Text style={styles.statusText}>
          {t(contactCount === 1 ? 'status.readyOne' : 'status.readyMany', { count: contactCount })}
        </Text>
      </View>
    </View>
  );
}

export default function WebDashboardScreen({ onNavigate }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
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
          {t('home.heading')}
        </Text>

        <StatusCard sosState={sosState} contactCount={contacts.length} onAddContacts={() => onNavigate('contacts')} />

        {apiStatus === 'DEV_MOCK' && isDevMockEnabled() ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{t('banner.testMode')}</Text>
          </View>
        ) : null}

        {apiStatus === 'OFFLINE' ? (
          <View style={styles.warnBanner} accessibilityRole="alert">
            <Text style={styles.warnTitle}>{t('banner.offlineTitle')}</Text>
            <Text style={styles.warnText}>{t('banner.offlineBody')}</Text>
          </View>
        ) : null}

        {contactsCachedAt ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{t('banner.cachedContacts')}</Text>
          </View>
        ) : null}

        {dispatchError ? (
          <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Text style={styles.errorTitle}>{t('error.notSent')}</Text>
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
            {t('card.sosTitle')}
          </Text>
          <Text style={styles.cardText}>{t('card.sosHelp')}</Text>

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
              <Text style={styles.countdownLabel}>{t('sos.countdownLabel')}</Text>
              <Text style={styles.countdownValue}>{t('sos.countdownValue', { seconds: countdownSeconds })}</Text>
              <AppButton label={t('sos.cancel')} variant="ghost" onPress={abortCountdown} />
            </View>
          ) : null}

          {sosState === SOS_STATES.ACTIVE_ALERT ? (
            <AppButton label={t('sos.stop')} variant="ghost" onPress={cancelAlert} />
          ) : null}

          {sosState === SOS_STATES.IDLE ? (
            <AppButton
              label={t('sos.sendWithoutHold')}
              variant="ghost"
              disabled={sosDisabled}
              onPress={() => setConfirmSos(true)}
              accessibilityHint={t('sos.sendHint')}
            />
          ) : null}

          <View style={styles.divider} />
          <AppButton
            label={t('sos.call112')}
            variant="critical"
            onPress={callEmergency}
            icon={<Feather name="phone-call" size={18} color={theme.color.onCritical} />}
            accessibilityHint={t('sos.callHint')}
          />
        </View>

        <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>
          {t('section.quick')}
        </Text>
        <View style={styles.tileGrid}>
          <QuickTile icon="map-pin" label={t('tile.share')} description={t('tile.shareDesc')} onPress={() => onNavigate('live')} />
          <QuickTile icon="users" label={t('tile.nearby')} description={t('tile.nearbyDesc')} onPress={() => onNavigate('sentinel')} />
          <QuickTile icon="phone" label={t('tile.contacts')} description={t('tile.contactsDesc')} onPress={() => onNavigate('contacts')} />
          <QuickTile icon="settings" label={t('tile.settings')} description={t('tile.settingsDesc')} onPress={() => onNavigate('settings')} />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmSos}
        title={t('confirm.sosTitle')}
        message={t('confirm.sosMessage')}
        confirmLabel={t('confirm.yes')}
        cancelLabel={t('confirm.no')}
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

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.lg, paddingBottom: 40, gap: theme.spacing.md },
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
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  statusSafe: { backgroundColor: theme.color.successSoft, borderWidth: 1, borderColor: theme.color.success },
  statusWarn: { backgroundColor: theme.color.warningSoft, borderWidth: 1, borderColor: theme.color.warning },
  statusAlert: { backgroundColor: theme.color.criticalFill },
  statusBody: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 20, fontWeight: '700' },
  statusText: { fontSize: 16, color: theme.color.text, lineHeight: 22 },
  statusTitleLight: { fontSize: 20, fontWeight: '700', color: theme.color.onCritical },
  statusTextLight: { fontSize: 16, color: theme.color.onCritical, lineHeight: 22 },
  inlineLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  inlineLinkText: { color: theme.color.accentOnSurface, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
  infoBanner: {
    backgroundColor: theme.color.primarySoft,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.accentOnSurface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  infoText: { color: theme.color.text, fontSize: 15, lineHeight: 22 },
  warnBanner: {
    backgroundColor: theme.color.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.warning,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  warnTitle: { color: theme.color.warning, fontWeight: '700', fontSize: 16 },
  warnText: { color: theme.color.text, fontSize: 15, lineHeight: 22 },
  errorBanner: {
    backgroundColor: theme.color.criticalSoft,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.critical,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  errorTitle: { color: theme.color.critical, fontWeight: '700', fontSize: 16 },
  errorText: { color: theme.color.text, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: theme.spacing.md,
  },
  cardTitle: { ...theme.typography.title, color: theme.color.text },
  cardText: { fontSize: 16, lineHeight: 24, color: theme.color.textMuted },
  sosSection: { alignItems: 'center', marginVertical: theme.spacing.sm },
  countdownCard: {
    alignItems: 'center',
    backgroundColor: theme.color.criticalSoft,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  countdownLabel: { color: theme.color.critical, fontWeight: '700', fontSize: 16 },
  countdownValue: { color: theme.color.critical, fontSize: 36, fontWeight: '800' },
  divider: { height: 1, backgroundColor: theme.color.border },
  sectionLabel: { ...theme.typography.title, color: theme.color.text, marginTop: theme.spacing.sm },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  tile: {
    width: '48.5%',
    minHeight: 120,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: 6,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { color: theme.color.text, fontWeight: '700', fontSize: 16 },
  tileDesc: { color: theme.color.textSubtle, fontSize: 14, lineHeight: 20 },
};
}
