import React, { useEffect } from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import FormField from '../../components/FormField';
import ChoiceSetting from '../../components/ChoiceSetting';
import { useThemedStyles } from '../../theme/useTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { validatePhone } from '../../store/useContactsStore';
import { LoadingState, SuccessBanner } from '../../components/UiStates';
import { apiClient, isMockFallbackActive, isDevMockEnabled } from '../../services/apiClient';
import { useI18n } from '../../i18n/useI18n';
import { LOCALES } from '../../i18n/translate';

function SwitchSetting({ label, description, value, onValueChange }) {
  const { theme, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: theme.color.borderStrong, true: theme.color.accentOnSurface }}
        thumbColor={theme.color.controlThumb}
        activeThumbColor={theme.color.controlThumb}
      />
    </View>
  );
}

export default function WebSettingsScreen({ onOpenProfile, signedIn }) {
  const { styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
  const settings = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const [saved, setSaved] = React.useState(false);
  const [formError, setFormError] = React.useState(null);

  useEffect(() => {
    settings.loadSettings();
    apiClient.healthCheck();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const current = useSettingsStore.getState();
    if (!current.displayName && profile.full_name) current.patch({ displayName: profile.full_name });
    if (!current.phone && profile.phone_e164) current.patch({ phone: profile.phone_e164 });
  }, [profile]);

  if (!settings.loaded) return <LoadingState message={t('settings.loading')} />;

  const handleSave = async () => {
    setFormError(null);
    const phone = settings.phone.trim();
    if (phone && !validatePhone(phone)) {
      setFormError(t('settings.phoneError'));
      return;
    }
    await settings.saveSettings();
    if (signedIn && user?.id) {
      const ok = await useProfileStore.getState().saveProfile(user.id, {
        full_name: settings.displayName,
        phone_e164: phone,
        email: user.email,
      });
      if (!ok) {
        setFormError(t('settings.savedLocally', { detail: useProfileStore.getState().error || '' }).trim());
        return;
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const serverMode = isMockFallbackActive()
    ? t('settings.modeSimulated')
    : isDevMockEnabled()
      ? t('settings.modeAvailable')
      : t('settings.modeLive');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {formError ? (
        <Text style={styles.formError} accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        {t('settings.appearance')}
      </Text>
      <ChoiceSetting
        label={t('settings.colourMode')}
        description={t('settings.colourModeDesc')}
        value={settings.scheme}
        onChange={(scheme) => settings.setAppearance({ scheme })}
        options={[
          { id: 'dark', label: t('settings.dark') },
          { id: 'light', label: t('settings.light') },
        ]}
      />
      <ChoiceSetting
        label={t('settings.language')}
        description={t('settings.languageDesc')}
        value={settings.locale}
        onChange={(locale) => settings.setLocale(locale)}
        options={LOCALES.map((item) => ({ id: item.id, label: item.nativeLabel }))}
      />
      <ChoiceSetting
        label={t('settings.accent')}
        description={t('settings.accentDesc')}
        value={settings.accent}
        onChange={(accent) => settings.setAppearance({ accent })}
        options={[
          { id: 'logo', label: t('settings.logoPurple'), swatch: '#B07CC0' },
          { id: 'white', label: t('settings.white'), swatch: '#FFFFFF' },
        ]}
      />
      <Text style={styles.note}>{t('settings.appliesNow')}</Text>

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        {t('settings.accessibility')}
      </Text>
      <ChoiceSetting
        label={t('settings.textSize')}
        description={t('settings.textSizeDesc')}
        value={settings.textScale}
        onChange={(textScale) => settings.setAppearance({ textScale })}
        options={[
          { id: 1, label: t('settings.defaultSize') },
          { id: 1.15, label: t('settings.large') },
          { id: 1.3, label: t('settings.extraLarge') },
        ]}
      />
      <SwitchSetting
        label={t('settings.reduceMotion')}
        description={t('settings.reduceMotionDesc')}
        value={settings.reduceMotion}
        onValueChange={(reduceMotion) => settings.setAppearance({ reduceMotion })}
      />
      <SwitchSetting
        label={t('settings.highContrast')}
        description={t('settings.highContrastDesc')}
        value={settings.highContrast}
        onValueChange={(highContrast) => settings.setAppearance({ highContrast })}
      />

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        {t('settings.personal')}
      </Text>
      <View style={styles.section}>
        {user?.email ? <Text style={styles.settingDesc}>{t('settings.signedIn', { email: user.email })}</Text> : null}
        <FormField
          label={t('settings.fullName')}
          value={settings.displayName}
          onChangeText={(displayName) => settings.patch({ displayName })}
          placeholder={t('settings.namePlaceholder')}
          autoCapitalize="words"
          autoComplete="name"
        />
        <FormField
          label={t('settings.mobile')}
          hint={t('settings.mobileHint')}
          value={settings.phone}
          onChangeText={(phone) => settings.patch({ phone })}
          placeholder="+919876543210"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </View>

      {signedIn ? (
        <View style={styles.section}>
          <Text style={styles.groupTitle} accessibilityRole="header" aria-level={2}>
            {t('settings.account')}
          </Text>
          <AppButton label={t('settings.profileButton')} variant="ghost" onPress={onOpenProfile} />
        </View>
      ) : null}

      {saved ? <SuccessBanner message={t('settings.saved')} /> : null}

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        {t('settings.howToStart')}
      </Text>
      <View style={styles.section}>
        <Text style={styles.settingLabel}>{t('settings.holdTitle')}</Text>
        <Text style={styles.settingDesc}>{t('settings.holdDesc')}</Text>
      </View>

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        {t('settings.advanced')}
      </Text>
      <View style={styles.section}>
        <FormField
          label={t('settings.server')}
          hint={t('settings.serverMode', { mode: serverMode })}
          value={settings.apiEndpoint}
          onChangeText={(v) => settings.patch({ apiEndpoint: v })}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      <AppButton label={t('settings.save')} variant="primary" onPress={handleSave} loading={settings.saving} />
    </ScrollView>
  );
}

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  groupHeading: { ...theme.typography.title, color: theme.color.text, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  groupTitle: { ...theme.typography.title, color: theme.color.text, marginBottom: theme.spacing.sm },
  section: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  settingHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  settingLabel: { color: theme.color.text, fontWeight: '700', fontSize: 16 },
  settingValue: { color: theme.color.accentOnSurface, fontWeight: '700', fontSize: 16 },
  settingDesc: { color: theme.color.textSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  slider: { width: '100%', height: 44, marginTop: theme.spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    minHeight: 64,
  },
  toggleText: { flex: 1, marginRight: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  choice: {
    minHeight: theme.minTouch,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.bg1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choiceOn: { backgroundColor: theme.color.selectedFill, borderColor: theme.color.borderStrong },
  choiceText: { color: theme.color.text, fontWeight: '700', fontSize: 15 },
  choiceTextOn: { color: theme.color.selectedText },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.color.borderStrong },
  note: { color: theme.color.textSubtle, fontSize: 14, lineHeight: 20, marginBottom: theme.spacing.sm },
  formError: { color: theme.color.critical, fontSize: 15, lineHeight: 22, fontWeight: '600', marginBottom: theme.spacing.sm },
};
}
