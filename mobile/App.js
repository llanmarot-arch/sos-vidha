import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import NativeApp from './NativeApp';
import WebApp from './web/WebApp';
import AuthFlow from './web/AuthFlow';
import { LoadingState } from './components/UiStates';
import { useAuthStore } from './store/useAuthStore';
import { useSettingsStore } from './store/useSettingsStore';
import { applyLiveAppearance } from './theme/appearance';
import { applyDocumentLocale } from './i18n/locale';
import { isSupabaseConfigured } from './lib/supabaseClient';

function ThemeBootstrap({ children }) {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    const current = useSettingsStore.getState();
    applyLiveAppearance(current);
    applyDocumentLocale(current.locale);
    loadSettings();
  }, [loadSettings]);

  return children;
}

function NativeAuthGate() {
  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, []);

  if (!initialized) {
    return <LoadingState message="LOADING SESSION…" />;
  }

  if (isSupabaseConfigured() && !session) {
    return <AuthFlow />;
  }

  return <NativeApp />;
}

export default function App() {
  return <ThemeBootstrap>{Platform.OS === 'web' ? <WebApp /> : <NativeAuthGate />}</ThemeBootstrap>;
}
