import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import NativeApp from './NativeApp';
import WebApp from './web/WebApp';
import AuthFlow from './web/AuthFlow';
import { LoadingState } from './components/UiStates';
import { useAuthStore } from './store/useAuthStore';
import { isSupabaseConfigured } from './lib/supabaseClient';

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
  if (Platform.OS === 'web') {
    return <WebApp />;
  }
  return <NativeAuthGate />;
}
