import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';
import {
  describeDeliveryStatus,
  describeChannel,
  describeAlertLocation,
} from '../services/apiClientPolicy';

const TONE_COLOR = {
  success: tokens.color.success,
  warning: tokens.color.warning,
  critical: tokens.color.critical,
  neutral: tokens.color.textMuted,
};

export default function AlertStatusPanel({ deliveries, alertsMode, alertLocation, followUpError, alertStatusError }) {
  const sorted = [...(deliveries || [])].sort((a, b) =>
    `${a.recipientName || a.to}${a.channel}`.localeCompare(`${b.recipientName || b.to}${b.channel}`)
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header" aria-level={2}>
        Alert status
      </Text>
      <Text style={styles.text}>Your SOS is recorded on the safety server.</Text>
      {alertsMode === 'dry_run' ? (
        <Text style={[styles.text, { color: tokens.color.warning }]}>
          Test mode: the server is not sending real messages. Call your contacts or 112 yourself.
        </Text>
      ) : null}
      {alertLocation ? <Text style={styles.text}>{describeAlertLocation(alertLocation)}</Text> : null}

      {followUpError ? (
        <Text style={[styles.text, { color: tokens.color.critical }]} accessibilityRole="alert">
          {followUpError}
        </Text>
      ) : null}

      <View role="list" aria-label="Messages to your emergency contacts" accessibilityLiveRegion="polite">
        {sorted.length === 0 ? (
          <Text style={styles.text}>Waiting for message status from the server…</Text>
        ) : (
          sorted.map((d) => {
            const status = describeDeliveryStatus(d.status);
            return (
              <View key={d.id} style={styles.row} role="listitem">
                <Text style={styles.rowName}>
                  {describeChannel(d.channel)} to {d.recipientName || d.to}
                </Text>
                <Text style={[styles.rowStatus, { color: TONE_COLOR[status.tone] }]}>{status.label}</Text>
              </View>
            );
          })
        )}
      </View>

      {alertStatusError ? <Text style={styles.subtle}>{alertStatusError}</Text> : null}
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
    gap: tokens.spacing.sm,
  },
  title: { ...tokens.typography.title, color: tokens.color.text },
  text: { fontSize: 16, lineHeight: 22, color: tokens.color.text },
  subtle: { fontSize: 14, lineHeight: 20, color: tokens.color.textSubtle },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
    gap: 2,
  },
  rowName: { fontSize: 16, fontWeight: '700', color: tokens.color.text },
  rowStatus: { fontSize: 15, lineHeight: 21 },
});
