import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AppButton from '../../components/AppButton';
import LogoMark from '../../components/LogoMark';
import { tokens } from '../../theme/tokens';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

const BENEFITS = [
  { icon: 'bell', text: 'Alert your trusted contacts with one long press' },
  { icon: 'map-pin', text: 'Share your live location until you are safe' },
  { icon: 'users', text: 'Get help from people nearby' },
];

export default function WelcomeScreen({ onSignIn, onCreateAccount }) {
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
              <Feather name={b.icon} size={20} color={tokens.color.success} />
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
          icon={<Feather name="phone-call" size={18} color={tokens.color.onCritical} />}
          accessibilityLabel="Call 112, emergency services"
          accessibilityHint="Opens your phone dialer. You must confirm the call."
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.xl, paddingBottom: 48, gap: tokens.spacing.lg },
  hero: { alignItems: 'center', marginTop: tokens.spacing.md, gap: tokens.spacing.sm },
  heroIcon: { marginBottom: tokens.spacing.sm },
  title: { color: tokens.color.text, fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
  subtitle: { color: tokens.color.textMuted, textAlign: 'center', fontSize: 17, lineHeight: 24 },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: tokens.spacing.md,
  },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, color: tokens.color.text, fontSize: 16, lineHeight: 22 },
  notice: {
    backgroundColor: tokens.color.warningSoft,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.warning,
  },
  noticeText: { color: tokens.color.text, fontSize: 15, lineHeight: 22 },
  actions: { gap: tokens.spacing.sm },
  emergencyBlock: {
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.criticalSoft,
    gap: tokens.spacing.sm,
  },
  emergencyLabel: { color: tokens.color.critical, fontSize: 18, fontWeight: '700' },
  emergencyHint: { color: tokens.color.text, fontSize: 15, lineHeight: 22 },
});
