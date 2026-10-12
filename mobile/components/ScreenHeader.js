import React from 'react';
import { View, Text } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

function createStyles(theme) {
  return {
    wrap: { marginBottom: theme.spacing.lg, gap: 6 },
    title: { ...theme.typography.hero, color: theme.color.text },
    subtitle: { ...theme.typography.subtitle, color: theme.color.textMuted },
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.successSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 4,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.success },
    statusText: { color: theme.color.success, fontSize: 14, fontWeight: '700' },
  };
}

export default function ScreenHeader({ title, subtitle, status }) {
  const { styles } = useThemedStyles(createStyles);
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
