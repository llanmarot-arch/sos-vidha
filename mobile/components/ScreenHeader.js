import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../theme/tokens';

export default function ScreenHeader({ title, subtitle, status }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {status ? (
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: tokens.spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...tokens.typography.hero, color: tokens.color.text },
  subtitle: { ...tokens.typography.subtitle, marginTop: 4, color: tokens.color.textMuted },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.color.surfaceElevated,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: tokens.color.primary,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.primaryBright },
  statusText: { color: tokens.color.primaryBright, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});
