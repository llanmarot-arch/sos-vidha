import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import FormField from '../../components/FormField';
import { tokens } from '../../theme/tokens';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProfileStore } from '../../store/useProfileStore';
import { validatePhone } from '../../store/useContactsStore';
import { LoadingState, SuccessBanner } from '../../components/UiStates';
import { apiClient, isMockFallbackActive, isDevMockEnabled } from '../../services/apiClient';

function SliderSetting({ label, valueLabel, description, ...sliderProps }) {
  return (
    <View style={styles.section}>
      <View style={styles.settingHead}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{valueLabel}</Text>
      </View>
      {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      <Slider
        style={styles.slider}
        accessibilityLabel={label}
        accessibilityValue={{ text: valueLabel }}
        minimumTrackTintColor={tokens.color.primary}
        maximumTrackTintColor={tokens.color.borderStrong}
        thumbTintColor={tokens.color.primary}
        {...sliderProps}
      />
    </View>
  );
}

function ChoiceSetting({ label, description, value, options, onChange }) {
  return (
    <View style={styles.section}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      <View style={styles.choices} accessibilityRole="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.id)}
              style={[styles.choice, selected && styles.choiceOn]}
            >
              {opt.swatch ? <View style={[styles.swatch, { backgroundColor: opt.swatch }]} /> : null}
              <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SwitchSetting({ label, description, value, onValueChange }) {
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
        trackColor={{ false: tokens.color.borderStrong, true: tokens.color.primary }}
        thumbColor={tokens.color.onPrimary}
        activeThumbColor={tokens.color.onPrimary}
      />
    </View>
  );
}

export default function WebSettingsScreen({ onOpenProfile, signedIn }) {
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

  if (!settings.loaded) return <LoadingState message="Loading settings…" />;

  const handleSave = async () => {
    setFormError(null);
    const phone = settings.phone.trim();
    if (phone && !validatePhone(phone)) {
      setFormError('Enter your mobile number with the country code, for example +919876543210.');
      return;
    }
    const { colorsChanged } = await settings.saveSettings();
    if (signedIn && user?.id) {
      const ok = await useProfileStore.getState().saveProfile(user.id, {
        full_name: settings.displayName,
        phone_e164: phone,
        email: user.email,
      });
      if (!ok) {
        setFormError(
          `Saved on this device. Your account could not be updated. ${useProfileStore.getState().error || ''}`.trim()
        );
        return;
      }
    }
    setSaved(true);
    if (colorsChanged && Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    setTimeout(() => setSaved(false), 4000);
  };

  const serverMode = isMockFallbackActive()
    ? 'Test mode (alerts are simulated)'
    : isDevMockEnabled()
      ? 'Test mode available'
      : 'Live';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Settings"
        subtitle="Appearance, accessibility, your details, and how SOS can be started."
      />

      {formError ? (
        <Text style={styles.formError} accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        Appearance
      </Text>
      <ChoiceSetting
        label="Colour mode"
        description="Dark is the default. Light uses a pale background."
        value={settings.scheme}
        onChange={(scheme) => settings.setAppearance({ scheme })}
        options={[
          { id: 'dark', label: 'Dark' },
          { id: 'light', label: 'Light' },
        ]}
      />
      <ChoiceSetting
        label="Accent"
        description="Logo purple matches the SOS mark. White is the other option."
        value={settings.accent}
        onChange={(accent) => settings.setAppearance({ accent })}
        options={[
          { id: 'logo', label: 'Logo purple', swatch: '#B07CC0' },
          { id: 'white', label: 'White', swatch: '#FFFFFF' },
        ]}
      />
      <Text style={styles.note}>Colour changes apply after you save. Text size and reduced motion apply straight away.</Text>

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        Accessibility
      </Text>
      <ChoiceSetting
        label="Text size"
        description="Makes the whole screen larger. Does not change what an SOS message says."
        value={settings.textScale}
        onChange={(textScale) => settings.setAppearance({ textScale })}
        options={[
          { id: 1, label: 'Default' },
          { id: 1.15, label: 'Large' },
          { id: 1.3, label: 'Extra large' },
        ]}
      />
      <SwitchSetting
        label="Reduce motion"
        description="Stops animations. The SOS button still works."
        value={settings.reduceMotion}
        onValueChange={(reduceMotion) => settings.setAppearance({ reduceMotion })}
      />
      <SwitchSetting
        label="High contrast"
        description="Stronger borders and a plainer background. Applies after you save."
        value={settings.highContrast}
        onValueChange={(highContrast) => settings.setAppearance({ highContrast })}
      />

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        Personal information
      </Text>
      <View style={styles.section}>
        {user?.email ? <Text style={styles.settingDesc}>Signed in as {user.email}</Text> : null}
        <FormField
          label="Full name"
          value={settings.displayName}
          onChangeText={(displayName) => settings.patch({ displayName })}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
        />
        <FormField
          label="Mobile number"
          hint="Include the country code, for example +919876543210. This is your number, not an emergency contact."
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
            Account
          </Text>
          <AppButton label="My profile and contacts" variant="ghost" onPress={onOpenProfile} />
        </View>
      ) : null}

      {saved ? <SuccessBanner message="Settings saved." /> : null}

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        Ways to start SOS
      </Text>

      <SliderSetting
        label="Power button presses"
        valueLabel={`${settings.powerButtonTaps} presses`}
        description="Press the power button this many times quickly to start SOS."
        minimumValue={2}
        maximumValue={5}
        step={1}
        value={settings.powerButtonTaps}
        onValueChange={(v) => settings.patch({ powerButtonTaps: Math.round(v) })}
      />

      <SwitchSetting
        label="Shake to start SOS"
        description="Shake your phone hard to start SOS."
        value={settings.shakeDetectionEnabled}
        onValueChange={(v) => settings.patch({ shakeDetectionEnabled: v })}
      />

      <SliderSetting
        label="Shake sensitivity"
        valueLabel={`${(settings.shakeSensitivity * 100).toFixed(0)}%`}
        description="Higher means a lighter shake will start SOS."
        minimumValue={0.2}
        maximumValue={1}
        step={0.05}
        value={settings.shakeSensitivity}
        onValueChange={(v) => settings.patch({ shakeSensitivity: v })}
      />

      <SwitchSetting
        label="Fall and crash detection"
        description="Start SOS automatically after a hard fall or crash. You can cancel."
        value={settings.impactDetectionEnabled}
        onValueChange={(v) => settings.patch({ impactDetectionEnabled: v })}
      />

      <SliderSetting
        label="Crash sensitivity"
        valueLabel={`${(settings.crashSensitivity * 100).toFixed(0)}%`}
        description="Higher means smaller impacts count as a crash."
        minimumValue={0.2}
        maximumValue={1}
        step={0.05}
        value={settings.crashSensitivity}
        onValueChange={(v) => settings.patch({ crashSensitivity: v })}
      />

      <Text style={styles.groupHeading} accessibilityRole="header" aria-level={2}>
        Advanced
      </Text>
      <View style={styles.section}>
        <FormField
          label="SOS server address"
          hint={`Mode: ${serverMode}`}
          value={settings.apiEndpoint}
          onChangeText={(v) => settings.patch({ apiEndpoint: v })}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      <AppButton label="Save settings" variant="primary" onPress={handleSave} loading={settings.saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 40 },
  groupHeading: { ...tokens.typography.title, color: tokens.color.text, marginTop: tokens.spacing.md, marginBottom: tokens.spacing.sm },
  groupTitle: { ...tokens.typography.title, color: tokens.color.text, marginBottom: tokens.spacing.sm },
  section: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  settingHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm },
  settingLabel: { color: tokens.color.text, fontWeight: '700', fontSize: 16 },
  settingValue: { color: tokens.color.primary, fontWeight: '700', fontSize: 16 },
  settingDesc: { color: tokens.color.textSubtle, fontSize: 14, lineHeight: 20, marginTop: 4 },
  slider: { width: '100%', height: 44, marginTop: tokens.spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.color.border,
    minHeight: 64,
  },
  toggleText: { flex: 1, marginRight: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
  choice: {
    minHeight: tokens.minTouch,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
    backgroundColor: tokens.color.bg1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choiceOn: { backgroundColor: tokens.color.primary, borderColor: tokens.color.borderStrong },
  choiceText: { color: tokens.color.text, fontWeight: '700', fontSize: 15 },
  choiceTextOn: { color: tokens.color.onPrimary },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: tokens.color.borderStrong },
  note: { color: tokens.color.textSubtle, fontSize: 14, lineHeight: 20, marginBottom: tokens.spacing.sm },
  formError: { color: tokens.color.critical, fontSize: 15, lineHeight: 22, fontWeight: '600', marginBottom: tokens.spacing.sm },
});
