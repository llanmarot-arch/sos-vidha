import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import FormField from '../../components/FormField';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useThemedStyles } from '../../theme/useTheme';
import { useContactsStore, validatePhone } from '../../store/useContactsStore';
import { LoadingState, EmptyState, SuccessBanner } from '../../components/UiStates';
import { useI18n } from '../../i18n/useI18n';

export default function WebContactsScreen({ userId }) {
  const { styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
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
      setErrorLocal(t('contacts.nameRequired'));
      return;
    }
    if (!validatePhone(phone)) {
      clearError();
      setErrorLocal(t('contacts.phoneInvalid'));
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

  if (loading) return <LoadingState message={t('contacts.loading')} />;

  if (requiresAuth) {
    return (
      <EmptyState
        title={t('contacts.signInTitle')}
        description={t('contacts.signInDesc')}
      />
    );
  }

  const displayError = localError || error;
  const countLabel = t('contacts.savedCount', { count: contacts.length });

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ScreenHeader
          title={t('contacts.title')}
          subtitle={t('contacts.subtitle')}
          status={countLabel}
        />

        {saveStatus === 'success' ? <SuccessBanner message={t('contacts.savedBanner')} /> : null}
        {displayError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.formTitle} accessibilityRole="header" aria-level={2}>
            {editingId ? t('contacts.editTitle') : t('contacts.addTitle')}
          </Text>
          <FormField label={t('contacts.name')} value={name} onChangeText={setName} placeholder={t('contacts.namePlaceholder')} autoCapitalize="words" autoComplete="name" />
          <FormField
            label={t('contacts.mobile')}
            hint={t('contacts.mobileHint')}
            value={phone}
            onChangeText={setPhone}
            placeholder="+919876543210"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          <FormField label={t('contacts.relationship')} value={relationship} onChangeText={setRelationship} placeholder={t('contacts.relationshipPlaceholder')} autoCapitalize="words" />
          <View style={styles.formActions}>
            {editingId ? (
              <View style={styles.flex1}>
                <AppButton label={t('contacts.cancel')} variant="ghost" onPress={resetForm} />
              </View>
            ) : null}
            <View style={styles.flex1}>
              <AppButton label={editingId ? t('contacts.saveChanges') : t('contacts.addButton')} variant="primary" onPress={handleSave} loading={submitting} />
            </View>
          </View>
        </View>

        <Text style={styles.listTitle} accessibilityRole="header" aria-level={2}>
          {t('contacts.yours')}
        </Text>
        {contacts.length === 0 ? (
          <EmptyState title={t('contacts.emptyTitle')} description={t('contacts.emptyDesc')} />
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
                  accessibilityLabel={t('contacts.editA11y', { name: contact.name })}
                >
                  <Text style={styles.editBtn}>{t('contacts.editTitle')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.actionBtn, styles.deleteAction]}
                  onPress={() => setDeleteTarget(contact)}
                  accessibilityRole="button"
                  accessibilityLabel={t('contacts.deleteA11y', { name: contact.name })}
                >
                  <Text style={styles.deleteBtn}>{t('contacts.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title={t('contacts.deleteTitle')}
        message={deleteTarget ? t('contacts.deleteMessage', { name: deleteTarget.name }) : ''}
        confirmLabel={deleting ? t('contacts.deleting') : t('contacts.delete')}
        cancelLabel={t('contacts.keep')}
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </>
  );
}

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  flex1: { flex: 1 },
  form: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.color.border },
  formTitle: { ...theme.typography.title, color: theme.color.text, marginBottom: theme.spacing.md },
  formActions: { flexDirection: 'row', gap: theme.spacing.sm },
  listTitle: { ...theme.typography.title, color: theme.color.text, marginBottom: theme.spacing.sm },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.color.border },
  cardBody: { marginBottom: theme.spacing.sm, gap: 2 },
  cardName: { color: theme.color.text, fontWeight: '700', fontSize: 18 },
  cardPhone: { color: theme.color.text, fontSize: 16 },
  cardRel: { color: theme.color.textSubtle, fontSize: 15 },
  cardActions: { flexDirection: 'row', gap: theme.spacing.sm },
  actionBtn: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.color.accentOnSurface,
  },
  deleteAction: { borderColor: theme.color.critical },
  editBtn: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16 },
  deleteBtn: { color: theme.color.critical, fontWeight: '700', fontSize: 16 },
  errorBox: { backgroundColor: theme.color.criticalSoft, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderLeftWidth: 4, borderLeftColor: theme.color.critical },
  errorText: { color: theme.color.critical, fontWeight: '600', fontSize: 15, lineHeight: 22 },
};
}
