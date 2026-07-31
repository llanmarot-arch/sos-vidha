import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { tokens } from '../theme/tokens';

export default function ConfirmDialog({ visible, title, message, confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', destructive = false, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.7} style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.confirmBtn, destructive && styles.confirmDestructive]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: tokens.color.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.xl,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  title: { color: tokens.color.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.4, marginBottom: tokens.spacing.sm },
  message: { color: tokens.color.textMuted, lineHeight: 20, marginBottom: tokens.spacing.lg },
  actions: { flexDirection: 'row', gap: tokens.spacing.sm },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { color: tokens.color.textMuted, fontWeight: '700', fontSize: 12 },
  confirmBtn: {
    flex: 1,
    backgroundColor: tokens.color.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmDestructive: { backgroundColor: tokens.color.critical },
  confirmText: { color: tokens.color.text, fontWeight: '800', fontSize: 12, letterSpacing: 0.4 },
});
