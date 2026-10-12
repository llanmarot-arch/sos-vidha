import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

function createStyles(theme) {
  return {
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.color.border,
    },
    title: { color: theme.color.text, fontWeight: '700', fontSize: 20, marginBottom: theme.spacing.sm },
    message: { color: theme.color.textMuted, fontSize: 16, lineHeight: 24, marginBottom: theme.spacing.lg },
    actions: { flexDirection: 'row', gap: theme.spacing.sm },
    cancelBtn: {
      flex: 1,
      minHeight: theme.minTouch,
      borderWidth: 1.5,
      borderColor: theme.color.ghostBorder,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface,
    },
    cancelText: { color: theme.color.ghostText, fontWeight: '700', fontSize: 16 },
    confirmBtn: {
      flex: 1,
      minHeight: theme.minTouch,
      backgroundColor: theme.color.primary,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.color.primaryBorderWidth,
      borderColor: theme.color.primaryBorder,
    },
    confirmDestructive: { backgroundColor: theme.color.criticalFill, borderWidth: 0 },
    confirmText: { color: theme.color.onPrimary, fontWeight: '700', fontSize: 16 },
    confirmTextDestructive: { color: theme.color.onCritical },
  };
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const { styles } = useThemedStyles(createStyles);
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
