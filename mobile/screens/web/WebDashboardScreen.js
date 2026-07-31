import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenHeader from '../../components/ScreenHeader';
import SOSHoldButton from '../../components/SOSHoldButton';
import AnomalyDashboard from '../../components/AnomalyDashboard';
import AppButton from '../../components/AppButton';
import { tokens, SOS_STATES } from '../../theme/tokens';
import { useSOSFlowStore } from '../../store/useSOSFlowStore';
import { useContactsStore } from '../../store/useContactsStore';
import { useSOSDispatch } from '../../hooks/useSOSDispatch';
import { isMockFallbackActive, apiClient } from '../../services/apiClient';
import { SuccessBanner } from '../../components/UiStates';

function QuickTile({ icon, label, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.tile} onPress={onPress}>
      <Feather name={icon} size={20} color={tokens.color.primaryBright} />
      <Text style={styles.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function WebDashboardScreen({ onNavigate }) {
  const sosState = useSOSFlowStore((s) => s.sosState);
  const countdownSeconds = useSOSFlowStore((s) => s.countdownSeconds);
  const dispatchError = useSOSFlowStore((s) => s.dispatchError);
  const contacts = useContactsStore((s) => s.contacts);
  const { beginCountdown, abortCountdown, cancelAlert, dispatchSOS } = useSOSDispatch();
  const [apiStatus, setApiStatus] = React.useState('CHECKING');

  useEffect(() => {
    apiClient.healthCheck()
      .then(() => setApiStatus(isMockFallbackActive() ? 'MOCK' : 'ONLINE'))
      .catch(() => setApiStatus('MOCK'));
  }, [sosState]);

  const systemStatus =
    sosState === SOS_STATES.ACTIVE_ALERT
      ? 'ALERT ACTIVE'
      : sosState === SOS_STATES.COUNTDOWN
        ? 'ABORT WINDOW'
        : 'SYSTEM ACTIVE';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="COMMAND DASHBOARD"
        subtitle="Personal safety protocol control surface"
        status={systemStatus}
      />

      {apiStatus === 'MOCK' ? (
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>MOCK ADAPTER ENGAGED · OFFLINE MODE</Text>
        </View>
      ) : null}

      {dispatchError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{dispatchError}</Text>
        </View>
      ) : null}

      {sosState === SOS_STATES.ACTIVE_ALERT ? (
        <SuccessBanner message="TELEMETRY SHARED · GUARDIANS NOTIFIED · SESSION LOGGED" />
      ) : null}

      <View style={styles.sosSection}>
        <SOSHoldButton
          sosState={sosState}
          disabled={contacts.length < 1}
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
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>ABORT WINDOW</Text>
          <Text style={styles.countdownValue}>{countdownSeconds}s</Text>
          <AppButton label="CANCEL DISPATCH" variant="ghost" onPress={abortCountdown} />
        </View>
      ) : null}

      {sosState === SOS_STATES.ACTIVE_ALERT ? (
        <AppButton label="TERMINATE SESSION" variant="ghost" onPress={cancelAlert} />
      ) : null}

      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.tileGrid}>
        <QuickTile icon="activity" label="LIVE TELEMETRY" onPress={() => onNavigate('live')} />
        <QuickTile icon="users" label="SENTINEL MESH" onPress={() => onNavigate('sentinel')} />
        <QuickTile icon="phone" label="GUARDIANS" onPress={() => onNavigate('contacts')} />
        <QuickTile icon="settings" label="SYSTEM CONFIG" onPress={() => onNavigate('settings')} />
      </View>

      <AnomalyDashboard onAutoTrigger={beginCountdown} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 110 },
  mockBanner: {
    backgroundColor: 'rgba(0,128,128,0.12)',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.primary,
  },
  mockText: { color: tokens.color.primaryBright, fontWeight: '700', fontSize: 11, letterSpacing: 0.6 },
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.color.critical,
  },
  errorText: { color: tokens.color.critical, fontWeight: '600', fontSize: 12 },
  sosSection: { alignItems: 'center', marginVertical: tokens.spacing.lg },
  countdownCard: {
    alignItems: 'center',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.critical,
    gap: tokens.spacing.sm,
  },
  countdownLabel: { color: tokens.color.critical, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  countdownValue: { color: tokens.color.text, fontSize: 42, fontWeight: '900' },
  sectionLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, marginBottom: tokens.spacing.sm, marginTop: tokens.spacing.md },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  tile: {
    width: '48%',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: tokens.spacing.sm,
  },
  tileLabel: { color: tokens.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
});
