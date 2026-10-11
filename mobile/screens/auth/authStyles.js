import { StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';

export const authStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.xl, paddingBottom: 48 },
  backBtn: { minHeight: tokens.minTouch, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: tokens.spacing.sm },
  back: { color: tokens.color.primary, fontWeight: '700', fontSize: 16 },
  title: { color: tokens.color.text, fontSize: 26, fontWeight: '700', marginBottom: 6, lineHeight: 32 },
  subtitle: { color: tokens.color.textMuted, marginBottom: tokens.spacing.lg, fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  bannerError: {
    color: tokens.color.critical,
    backgroundColor: tokens.color.criticalSoft,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.critical,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.md,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bannerSuccess: {
    color: tokens.color.success,
    backgroundColor: tokens.color.successSoft,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.success,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.md,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  linkBtn: { minHeight: tokens.minTouch, justifyContent: 'center', alignSelf: 'center', marginTop: tokens.spacing.sm },
  link: { color: tokens.color.primary, fontWeight: '700', fontSize: 16, textDecorationLine: 'underline' },
});
