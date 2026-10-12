import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sosvidha/sentinel_settings';

export const useSentinelStore = create((set, get) => ({
  activeSentinels: null,
  privacyRadiusM: 150,
  broadcastEnabled: false,
  lastPingAt: null,
  nearbyPings: [],
  unavailableNote: null,
  loading: false,

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) set(JSON.parse(raw));
  },

  persist: async (patch) => {
    const next = { ...get(), ...patch };
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        privacyRadiusM: next.privacyRadiusM,
        broadcastEnabled: next.broadcastEnabled,
      })
    );
    set(patch);
  },

  setPrivacyRadius: (privacyRadiusM) => get().persist({ privacyRadiusM }),

  setBroadcastEnabled: (broadcastEnabled) => get().persist({ broadcastEnabled }),

  sendPing: () => {
    set({
      unavailableNote: 'Nearby alerts are not connected. This did not contact anyone.',
    });
  },

  checkIn: () => {
    set({
      unavailableNote: 'A safety check-in to people nearby is not available.',
    });
  },
}));
