import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput } from 'react-native';
import Slider from '@react-native-community/slider';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/AppButton';
import { tokens } from '../../theme/tokens';
import { useSettingsStore } from '../../store/useSettingsStore';
import { LoadingState, SuccessBanner } from '../../components/UiStates';
import { apiClient, isMockFallbackActive } from '../../services/apiClient';

export default function WebSettingsScreen() {
  const settings = useSettingsStore();
  const [saved, setSaved] = React.useState(false);

  useEffect(() => {
    settings.loadSettings();
    apiClient.healthCheck();
  }, []);

  if (!settings.loaded) return <LoadingState message="LOADING SYSTEM CONFIG…" />;

  const handleSave = async () => {
    await settings.saveSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader title="SYSTEM SETTINGS" subtitle="Hardware triggers and API configuration" status="CONFIG PANEL" />

      {saved ? <SuccessBanner message="CONFIGURATION SAVED TO LOCAL STORAGE" /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>API ENDPOINT</Text>
        <TextInput
          style={styles.input}
          value={settings.apiEndpoint}
          onChangeText={(v) => settings.patch({ apiEndpoint: v })}
          placeholderTextColor={tokens.color.textSubtle}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          STATUS: {isMockFallbackActive() ? 'MOCK ADAPTER ENGAGED' : 'ENDPOINT CONNECTED'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>POWER BUTTON TAP COUNT · {settings.powerButtonTaps}</Text>
        <Slider
          minimumValue={2}
          maximumValue={5}
          step={1}
          value={settings.powerButtonTaps}
          onValueChange={(v) => settings.patch({ powerButtonTaps: Math.round(v) })}
          minimumTrackTintColor={tokens.color.primaryBright}
          maximumTrackTintColor={tokens.color.border}
          thumbTintColor={tokens.color.primaryBright}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SHAKE SENSITIVITY · {(settings.shakeSensitivity * 100).toFixed(0)}%</Text>
        <Slider
          minimumValue={0.2}
          maximumValue={1}
          step={0.05}
          value={settings.shakeSensitivity}
          onValueChange={(v) => settings.patch({ shakeSensitivity: v })}
          minimumTrackTintColor={tokens.color.primaryBright}
          maximumTrackTintColor={tokens.color.border}
          thumbTintColor={tokens.color.primaryBright}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CRASH DETECTION SENSITIVITY · {(settings.crashSensitivity * 100).toFixed(0)}%</Text>
        <Slider
          minimumValue={0.2}
          maximumValue={1}
          step={0.05}
          value={settings.crashSensitivity}
          onValueChange={(v) => settings.patch({ crashSensitivity: v })}
          minimumTrackTintColor={tokens.color.primaryBright}
          maximumTrackTintColor={tokens.color.border}
          thumbTintColor={tokens.color.primaryBright}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>IMPACT DETECTION ENABLED</Text>
        <Switch
          value={settings.impactDetectionEnabled}
          onValueChange={(v) => settings.patch({ impactDetectionEnabled: v })}
          trackColor={{ false: tokens.color.border, true: tokens.color.primary }}
          thumbColor={tokens.color.text}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>SHAKE TRIGGER ENABLED</Text>
        <Switch
          value={settings.shakeDetectionEnabled}
          onValueChange={(v) => settings.patch({ shakeDetectionEnabled: v })}
          trackColor={{ false: tokens.color.border, true: tokens.color.primary }}
          thumbColor={tokens.color.text}
        />
      </View>

      <AppButton label="SAVE CONFIGURATION" variant="primary" onPress={handleSave} loading={settings.saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 110 },
  section: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, marginBottom: tokens.spacing.md, borderWidth: 1, borderColor: tokens.color.border },
  sectionLabel: { ...tokens.typography.caption, color: tokens.color.textMuted, marginBottom: tokens.spacing.sm },
  input: { backgroundColor: tokens.color.bg2, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.border, paddingHorizontal: 14, paddingVertical: 12, color: tokens.color.text, marginBottom: tokens.spacing.sm },
  hint: { color: tokens.color.textSubtle, fontSize: 11, letterSpacing: 0.4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, marginBottom: tokens.spacing.sm, borderWidth: 1, borderColor: tokens.color.border },
  toggleLabel: { color: tokens.color.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5, flex: 1, marginRight: 12 },
});
