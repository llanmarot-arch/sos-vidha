import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

export default function ChoiceSetting({ label, description, value, options, onChange }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      <View style={styles.choices} accessibilityRole="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <TouchableOpacity
              key={String(opt.id)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ checked: selected, selected }}
              onPress={() => onChange(opt.id)}
              style={[styles.choice, selected && styles.choiceOn]}
            >
              {opt.swatch ? <View style={[styles.swatch, { backgroundColor: opt.swatch }]} /> : null}
              <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme) {
  return {
    section: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.color.border,
    },
    settingLabel: { color: theme.color.text, fontWeight: '700', fontSize: 16 },
    settingDesc: { color: theme.color.textSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
    choice: {
      minHeight: theme.minTouch,
      paddingHorizontal: 14,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.color.borderStrong,
      backgroundColor: theme.color.bg1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    choiceOn: { backgroundColor: theme.color.selectedFill, borderColor: theme.color.borderStrong },
    choiceText: { color: theme.color.text, fontWeight: '700', fontSize: 15 },
    choiceTextOn: { color: theme.color.selectedText },
    swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.color.borderStrong },
  };
}
