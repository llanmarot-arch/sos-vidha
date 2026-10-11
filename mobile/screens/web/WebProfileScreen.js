import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import FormField from '../../components/FormField';
import AppButton from '../../components/AppButton';
import { tokens } from '../../theme/tokens';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { useContactsStore, validatePhone } from '../../store/useContactsStore';
import { LoadingState, EmptyState, SuccessBanner } from '../../components/UiStates';

export default function WebProfileScreen({ onBack, onManageGuardians }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useProfileStore((s) => s.profile);
  const loadProfile = useProfileStore((s) => s.loadProfile);
  const saveProfile = useProfileStore((s) => s.saveProfile);
  const saveStatus = useProfileStore((s) => s.saveStatus);
  const profileError = useProfileStore((s) => s.error);
  const contacts = useContactsStore((s) => s.contacts);
  const loadContacts = useContactsStore((s) => s.loadContacts);
  const contactsLoading = useContactsStore((s) => s.loading);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id);
      loadContacts(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone_e164 || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setLocalError(null);
    if (phone && !validatePhone(phone)) {
      setLocalError('Enter your mobile number with country code, for example +919876543210.');
      return;
    }
    setSaving(true);
    await saveProfile(user.id, {
      full_name: fullName,
      phone_e164: phone,
      email: user.email,
    });
    setSaving(false);
  };

  if (!user) {
    return <EmptyState title="You're not signed in" description="Sign in to see your profile." />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <ScreenHeader title="My profile" subtitle={`Signed in as ${user.email}`} />

      {saveStatus === 'success' ? <SuccessBanner message="Profile saved." /> : null}
      {(localError || profileError) && (
        <Text style={styles.error} accessibilityRole="alert">
          {localError || profileError}
        </Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={2}>
          Your details
        </Text>
        <FormField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" autoCapitalize="words" autoComplete="name" />
        <FormField
          label="Mobile number"
          hint="Include country code, e.g. +91 98765 43210"
          value={phone}
          onChangeText={setPhone}
          placeholder="+919876543210"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <AppButton label="Save profile" variant="primary" onPress={handleSave} loading={saving} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header" aria-level={2}>
          Emergency contacts
        </Text>
        {contactsLoading ? (
          <LoadingState message="Loading your contacts…" />
        ) : contacts.length === 0 ? (
          <EmptyState title="No contacts yet" description="Add people who should get your SOS alerts." />
        ) : (
          contacts.map((c) => (
            <View key={c.id} style={styles.contactRow}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>{c.phone}</Text>
              <Text style={styles.contactRel}>{c.relationship}</Text>
            </View>
          ))
        )}
        <AppButton label="Manage contacts" variant="ghost" onPress={onManageGuardians} />
      </View>

      <AppButton label="Sign out" variant="ghost" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 40 },
  backBtn: { minHeight: tokens.minTouch, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: tokens.spacing.sm },
  back: { color: tokens.color.primary, fontWeight: '700', fontSize: 16 },
  section: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    gap: tokens.spacing.sm,
  },
  sectionTitle: { ...tokens.typography.title, color: tokens.color.text, marginBottom: tokens.spacing.sm },
  contactRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  contactName: { color: tokens.color.text, fontWeight: '700', fontSize: 16 },
  contactPhone: { color: tokens.color.text, marginTop: 2, fontSize: 15 },
  contactRel: { color: tokens.color.textSubtle, fontSize: 14, marginTop: 2 },
  error: { color: tokens.color.critical, marginBottom: tokens.spacing.md, lineHeight: 22, fontSize: 15, fontWeight: '600' },
});
