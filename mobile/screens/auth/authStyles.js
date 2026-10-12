import { useThemedStyles } from '../../theme/useTheme';

export function createAuthStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.xl, paddingBottom: 48 },
  backBtn: { minHeight: theme.minTouch, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: theme.spacing.sm },
  back: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16 },
  title: { color: theme.color.text, fontSize: 26, fontWeight: '700', marginBottom: 6, lineHeight: 32 },
  subtitle: { color: theme.color.textMuted, marginBottom: theme.spacing.lg, fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  bannerError: {
    color: theme.color.critical,
    backgroundColor: theme.color.criticalSoft,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.critical,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bannerSuccess: {
    color: theme.color.success,
    backgroundColor: theme.color.successSoft,
    borderLeftWidth: 4,
    borderLeftColor: theme.color.success,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  linkBtn: { minHeight: theme.minTouch, justifyContent: 'center', alignSelf: 'center', marginTop: theme.spacing.sm },
  link: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16, textDecorationLine: 'underline' },
  };
}

export function useAuthStyles() {
  return useThemedStyles(createAuthStyles).styles;
}
