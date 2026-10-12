import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { createTheme } from './palette';

export function useTheme() {
  const scheme = useSettingsStore((s) => s.scheme);
  const accent = useSettingsStore((s) => s.accent);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const textScale = useSettingsStore((s) => s.textScale);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  return useMemo(
    () => createTheme({ scheme, accent, highContrast, textScale, reduceMotion }),
    [scheme, accent, highContrast, textScale, reduceMotion]
  );
}

/** Recreates styles when the theme changes. `factory` must be a stable function. */
export function useThemedStyles(factory) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
  return { theme, styles };
}
