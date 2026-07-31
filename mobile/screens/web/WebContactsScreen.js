import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import ConfirmDialog from '../../components/ConfirmDialog';
import { tokens } from '../../theme/tokens';
import { useContactsStore, validatePhone } from '../../store/useContactsStore';
import { LoadingState, EmptyState, SuccessBanner } from '../../components/UiStates';

export default function WebContactsScreen() {
  const { contacts, loading, error, saveStatus, loadContacts, addContact, updateContact, deleteContact, clearError } =
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
    loadContacts();
  }, []);

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
      setErrorLocal('Contact name is required.');
      return;
    }
    if (!validatePhone(phone)) {
      clearError();
      setErrorLocal('Use E.164 format. Example: +919876543210');
      return;
    }

    setSubmitting(true);
    const payload = { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || 'GUARDIAN' };
    const ok = editingId ? await updateContact(editingId, payload) : await addContact(payload);
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
    await deleteContact(deleteTarget.id);
    if (editingId === deleteTarget.id) resetForm();
    setDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) return <LoadingState message="LOADING GUARDIAN REGISTRY…" />;

  const displayError = localError || error;

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ScreenHeader title="GUARDIAN CONTACTS" subtitle="Emergency notification registry" status={`${contacts.length} REGISTERED`} />

        {saveStatus === 'success' ? <SuccessBanner message="REGISTRY UPDATED · CHANGES PERSISTED" /> : null}
        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'EDIT ENTRY' : 'ADD ENTRY'}</Text>
          <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={tokens.color.textSubtle} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Phone (+919876543210)" placeholderTextColor={tokens.color.textSubtle} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Relationship" placeholderTextColor={tokens.color.textSubtle} value={relationship} onChangeText={setRelationship} />
          <View style={styles.formActions}>
            {editingId ? <AppButton label="CANCEL" variant="ghost" onPress={resetForm} /> : null}
            <AppButton label={editingId ? 'UPDATE ENTRY' : 'ADD CONTACT'} variant="primary" onPress={handleSave} loading={submitting} />
          </View>
        </View>

        {contacts.length === 0 ? (
          <EmptyState title="REGISTRY EMPTY" description="Add guardian contacts to enable SOS dispatch and WhatsApp live location sharing." />
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{contact.name}</Text>
                <Text style={styles.cardPhone}>{contact.phone}</Text>
                <Text style={styles.cardRel}>{contact.relationship}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn} onPress={() => startEdit(contact)}>
                  <Text style={styles.editBtn}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn} onPress={() => setDeleteTarget(contact)}>
                  <Text style={styles.deleteBtn}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="DELETE CONTACT"
        message={deleteTarget ? `Remove ${deleteTarget.name} from the guardian registry? This action cannot be undone.` : ''}
        confirmLabel={deleting ? 'DELETING…' : 'DELETE'}
        cancelLabel="CANCEL"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 110 },
  form: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, marginBottom: tokens.spacing.lg, borderWidth: 1, borderColor: tokens.color.border },
  formTitle: { ...tokens.typography.caption, color: tokens.color.primaryBright, marginBottom: tokens.spacing.md },
  input: { backgroundColor: tokens.color.bg2, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.border, paddingHorizontal: 14, paddingVertical: 12, color: tokens.color.text, marginBottom: tokens.spacing.sm },
  formActions: { flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  card: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, marginBottom: tokens.spacing.sm, borderWidth: 1, borderColor: tokens.color.border },
  cardBody: { marginBottom: tokens.spacing.sm },
  cardName: { color: tokens.color.text, fontWeight: '800', fontSize: 15 },
  cardPhone: { color: tokens.color.primaryBright, marginTop: 4, fontWeight: '600' },
  cardRel: { color: tokens.color.textMuted, marginTop: 2, fontSize: 11, letterSpacing: 0.4 },
  cardActions: { flexDirection: 'row', gap: tokens.spacing.lg },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  editBtn: { color: tokens.color.primaryBright, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  deleteBtn: { color: tokens.color.critical, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  errorBox: { backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: tokens.radius.md, padding: tokens.spacing.md, marginBottom: tokens.spacing.md, borderWidth: 1, borderColor: tokens.color.critical },
  errorText: { color: tokens.color.critical, fontWeight: '600', fontSize: 12 },
});
