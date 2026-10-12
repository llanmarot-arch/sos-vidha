import React from 'react';
import { View, Text } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';
import { describeDeliveryStatus, describeChannel, describeAlertLocation } from '../services/apiClientPolicy';

function toneColor(theme, tone) {
  if (tone === 'success') return theme.color.success;
  if (tone === 'warning') return theme.color.warning;
  if (tone === 'critical') return theme.color.critical;
  return theme.color.textMuted;
}

function createStyles(theme) {
  return {
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.color.border,
      gap: theme.spacing.sm,
    },
    title: { ...theme.typography.title, color: theme.color.text },
    text: { fontSize: 16, lineHeight: 22, color: theme.color.text },
    subtle: { fontSize: 14, lineHeight: 20, color: theme.color.textSubtle },
    row: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border,
      gap: 2,
    },
    rowName: { fontSize: 16, fontWeight: '700', color: theme.color.text },
    rowStatus: { fontSize: 15, lineHeight: 21 },
  };
}

export default function AlertStatusPanel({ deliveries, alertsMode, alertLocation, followUpError, alertStatusError }) {
  const { theme, styles } = useThemedStyles(createStyles);
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
        <Text style={[styles.text, { color: theme.color.warning }]}>
          Test mode: the server is not sending real messages. Call your contacts or 112 yourself.
        </Text>
      ) : null}
      {alertLocation ? <Text style={styles.text}>{describeAlertLocation(alertLocation)}</Text> : null}

      {followUpError ? (
        <Text style={[styles.text, { color: theme.color.critical }]} accessibilityRole="alert">
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
                <Text style={[styles.rowStatus, { color: toneColor(theme, status.tone) }]}>{status.label}</Text>
              </View>
            );
          })
        )}
      </View>

      {alertStatusError ? <Text style={styles.subtle}>{alertStatusError}</Text> : null}
    </View>
  );
}
