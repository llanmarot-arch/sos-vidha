import React from 'react';
import { View, Text, ScrollView, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AppButton from '../../components/AppButton';
import LogoMark from '../../components/LogoMark';
import { useThemedStyles } from '../../theme/useTheme';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

const BENEFITS = [
  { icon: 'bell', text: 'Alert your trusted contacts with one long press' },
  { icon: 'map-pin', text: 'Share your live location until you are safe' },
  { icon: 'users', text: 'Get help from people nearby' },
];

export default function WelcomeScreen({ onSignIn, onCreateAccount }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const configured = isSupabaseConfigured();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <LogoMark size={112} />
        </View>
        <Text style={styles.title} accessibilityRole="header" aria-level={1}>
          Stay safe with SOS-Vidha
        </Text>
        <Text style={styles.subtitle}>Your personal safety companion</Text>
      </View>

      <View style={styles.card}>
        {BENEFITS.map((b) => (
          <View key={b.icon} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Feather name={b.icon} size={20} color={theme.color.success} />
            </View>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      {!configured ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>
            Sign-in isn't set up on this version of the site yet. Please try again later.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <AppButton label="Sign in" variant="primary" onPress={onSignIn} disabled={!configured} />
        <AppButton label="Create an account" variant="ghost" onPress={onCreateAccount} disabled={!configured} />
      </View>

      <View style={styles.emergencyBlock}>
        <Text style={styles.emergencyLabel} accessibilityRole="header" aria-level={2}>
          In danger right now?
        </Text>
        <Text style={styles.emergencyHint}>You don't need an account to call emergency services.</Text>
        <AppButton
          label="Call 112"
          variant="critical"
          onPress={() => Linking.openURL('tel:112')}
          icon={<Feather name="phone-call" size={18} color={theme.color.onCritical} />}
          accessibilityLabel="Call 112, emergency services"
          accessibilityHint="Opens your phone dialer. You must confirm the call."
        />
      </View>
    </ScrollView>
  );
}

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.xl, paddingBottom: 48, gap: theme.spacing.lg },
  hero: { alignItems: 'center', marginTop: theme.spacing.md, gap: theme.spacing.sm },
  heroIcon: { marginBottom: theme.spacing.sm },
  title: { color: theme.color.text, fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
  subtitle: { color: theme.color.textMuted, textAlign: 'center', fontSize: 17, lineHeight: 24 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: theme.spacing.md,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, color: theme.color.text, fontSize: 16, lineHeight: 22 },
  notice: {
    backgroundColor: theme.color.warningSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.warning,
  },
  noticeText: { color: theme.color.text, fontSize: 15, lineHeight: 22 },
  actions: { gap: theme.spacing.sm },
  emergencyBlock: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.criticalSoft,
    gap: theme.spacing.sm,
  },
  emergencyLabel: { color: theme.color.critical, fontSize: 18, fontWeight: '700' },
  emergencyHint: { color: theme.color.text, fontSize: 15, lineHeight: 22 },
};
}
