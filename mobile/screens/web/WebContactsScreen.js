import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import { tokens } from '../../theme/tokens';
import { useContactsStore, validatePhone } from '../../store/useContactsStore';
import { LoadingState, EmptyState, SuccessBanner } from '../../components/UiStates';

export default function WebContactsScreen({ userId }) {
  const { contacts, loading, error, saveStatus, requiresAuth, loadContacts, addContact, updateContact, deleteContact, clearError } =
    useContactsStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [localError, setErrorLocal] = useState(null);

  useEffect(() => {
    loadContacts(userId);
  }, [userId]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setRelationship('');
    setEditingId(null);
    clearError();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      clearError();
      setErrorLocal('Please enter a name.');
      return;
    }
    if (!validatePhone(phone)) {
      clearError();
      setErrorLocal('Enter the mobile number with country code, for example +919876543210.');
      return;
    }

    setSubmitting(true);
    const payload = { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || 'GUARDIAN' };
    const ok = editingId ? await updateContact(editingId, payload, userId) : await addContact(payload, userId);
    setSubmitting(false);
    if (ok) resetForm();
  };

  const startEdit = (contact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setRelationship(contact.relationship);
    setErrorLocal(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteContact(deleteTarget.id, userId);
    if (editingId === deleteTarget.id) resetForm();
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) return <LoadingState message="Loading your contacts…" />;

  if (requiresAuth) {
    return (
      <EmptyState
        title="Please sign in"
        description="Your emergency contacts are saved to your account. Sign in to add or change them."
      />
    );
  }

  const displayError = localError || error;
  const countLabel = `${contacts.length} saved`;

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Emergency contacts"
          subtitle="These people get your SOS alert and live location."
          status={countLabel}
        />

        {saveStatus === 'success' ? <SuccessBanner message="Contacts saved." /> : null}
        {displayError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.formTitle} accessibilityRole="header" aria-level={2}>
            {editingId ? 'Edit contact' : 'Add a contact'}
          </Text>
          <FormField label="Name" value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" autoCapitalize="words" autoComplete="name" />
          <FormField
            label="Mobile number"
            hint="Include country code, e.g. +91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            placeholder="+919876543210"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <FormField label="Relationship (optional)" value={relationship} onChangeText={setRelationship} placeholder="e.g. Mother, Friend" autoCapitalize="words" />
          <View style={styles.formActions}>
            {editingId ? (
              <View style={styles.flex1}>
                <AppButton label="Cancel" variant="ghost" onPress={resetForm} />
              </View>
            ) : null}
            <View style={styles.flex1}>
              <AppButton label={editingId ? 'Save changes' : 'Add contact'} variant="primary" onPress={handleSave} loading={submitting} />
            </View>
          </View>
        </View>

        <Text style={styles.listTitle} accessibilityRole="header" aria-level={2}>
          Your contacts
        </Text>
        {contacts.length === 0 ? (
          <EmptyState title="No contacts yet" description="Add at least one person so SOS and WhatsApp location sharing can work." />
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{contact.name}</Text>
                <Text style={styles.cardPhone}>{contact.phone}</Text>
                {contact.relationship ? <Text style={styles.cardRel}>{contact.relationship}</Text> : null}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionBtn}
                  onPress={() => startEdit(contact)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${contact.name}`}
                >
                  <Text style={styles.editBtn}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.actionBtn, styles.deleteAction]}
                  onPress={() => setDeleteTarget(contact)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${contact.name}`}
                >
                  <Text style={styles.deleteBtn}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete this contact?"
        message={deleteTarget ? `${deleteTarget.name} will no longer get your SOS alerts. This can't be undone.` : ''}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Keep contact"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 40 },
  flex1: { flex: 1 },
  form: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, marginBottom: tokens.spacing.lg, borderWidth: 1, borderColor: tokens.color.border },
  formTitle: { ...tokens.typography.title, color: tokens.color.text, marginBottom: tokens.spacing.md },
  formActions: { flexDirection: 'row', gap: tokens.spacing.sm },
  listTitle: { ...tokens.typography.title, color: tokens.color.text, marginBottom: tokens.spacing.sm },
  card: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, marginBottom: tokens.spacing.sm, borderWidth: 1, borderColor: tokens.color.border },
  cardBody: { marginBottom: tokens.spacing.sm, gap: 2 },
  cardName: { color: tokens.color.text, fontWeight: '700', fontSize: 18 },
  cardPhone: { color: tokens.color.text, fontSize: 16 },
  cardRel: { color: tokens.color.textSubtle, fontSize: 15 },
  cardActions: { flexDirection: 'row', gap: tokens.spacing.sm },
  actionBtn: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: tokens.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.primary,
  },
  deleteAction: { borderColor: tokens.color.critical },
  editBtn: { color: tokens.color.primary, fontWeight: '700', fontSize: 16 },
  deleteBtn: { color: tokens.color.critical, fontWeight: '700', fontSize: 16 },
  errorBox: { backgroundColor: tokens.color.criticalSoft, borderRadius: tokens.radius.md, padding: tokens.spacing.md, marginBottom: tokens.spacing.md, borderLeftWidth: 4, borderLeftColor: tokens.color.critical },
  errorText: { color: tokens.color.critical, fontWeight: '600', fontSize: 15, lineHeight: 22 },
});
