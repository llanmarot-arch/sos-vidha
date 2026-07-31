import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@sosvidha/sentinel_settings';

export const useSentinelStore = create((set, get) => ({
  activeSentinels: 7,
  privacyRadiusM: 150,
  broadcastEnabled: true,
  lastPingAt: null,
  nearbyPings: [],
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
    const ping = {
      id: `ping-${Date.now()}`,
      distanceM: Math.round(80 + Math.random() * 400),
      masked: true,
      timestamp: Date.now(),
    };
    set((state) => ({
      lastPingAt: Date.now(),
      activeSentinels: Math.max(3, state.activeSentinels + (Math.random() > 0.7 ? 1 : 0)),
      nearbyPings: [ping, ...state.nearbyPings].slice(0, 8),
    }));
  },

  checkIn: () => {
    set({ lastPingAt: Date.now(), activeSentinels: get().activeSentinels + 1 });
  },
}));
