import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { tokens } from '../theme/tokens';

export default function ConfirmDialog({ visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel} accessibilityLabel="Close dialog">
        <Pressable
          style={styles.card}
          onPress={(e) => e.stopPropagation?.()}
          accessibilityViewIsModal
          role="alertdialog"
          aria-modal
          aria-label={title}
        >
          <Text style={styles.title} accessibilityRole="header" aria-level={2}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.7} style={styles.cancelBtn} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.confirmBtn, destructive && styles.confirmDestructive]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>{confirmLabel}</Text>
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
    maxWidth: 400,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.xl,
  },
  title: { color: tokens.color.text, fontWeight: '700', fontSize: 20, marginBottom: tokens.spacing.sm },
  message: { color: tokens.color.textMuted, fontSize: 16, lineHeight: 24, marginBottom: tokens.spacing.lg },
  actions: { flexDirection: 'row', gap: tokens.spacing.sm },
  cancelBtn: {
    flex: 1,
    minHeight: tokens.minTouch,
    borderWidth: 1.5,
    borderColor: tokens.accent === 'white' && tokens.scheme === 'light' ? tokens.color.borderStrong : tokens.color.primary,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: tokens.accent === 'white' && tokens.scheme === 'light' ? tokens.color.text : tokens.color.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  confirmBtn: {
    flex: 1,
    minHeight: tokens.minTouch,
    backgroundColor: tokens.color.primary,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructive: { backgroundColor: tokens.color.criticalFill },
  confirmText: { color: tokens.color.onPrimary, fontWeight: '700', fontSize: 16 },
  confirmTextDestructive: { color: tokens.color.onCritical },
});
