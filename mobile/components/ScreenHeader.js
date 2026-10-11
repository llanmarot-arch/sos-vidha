import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

export default function ScreenHeader({ title, subtitle, status }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header" aria-level={1}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {status ? (
        <View style={styles.statusPill} accessibilityLabel={`Status: ${status}`}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: tokens.spacing.lg, gap: 6 },
  title: { ...tokens.typography.hero, color: tokens.color.text },
  subtitle: { ...tokens.typography.subtitle, color: tokens.color.textMuted },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.color.successSoft,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.color.success },
  statusText: { color: tokens.color.success, fontSize: 14, fontWeight: '700' },
});
