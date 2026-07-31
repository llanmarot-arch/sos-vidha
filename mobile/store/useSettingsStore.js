import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

const STORAGE_KEY = '@sosvidha/system_settings';

const DEFAULTS = {
  apiEndpoint: API_BASE_URL,
  powerButtonTaps: 3,
  shakeSensitivity: 0.65,
  crashSensitivity: 0.75,
  impactDetectionEnabled: true,
  shakeDetectionEnabled: true,
};

export const useSettingsStore = create((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  saving: false,

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) set({ ...JSON.parse(raw), loaded: true });
    else set({ loaded: true });
  },

  patch: (patch) => set(patch),

  saveSettings: async () => {
    set({ saving: true });
    const state = get();
    const payload = {
      apiEndpoint: state.apiEndpoint,
      powerButtonTaps: state.powerButtonTaps,
      shakeSensitivity: state.shakeSensitivity,
      crashSensitivity: state.crashSensitivity,
      impactDetectionEnabled: state.impactDetectionEnabled,
      shakeDetectionEnabled: state.shakeDetectionEnabled,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    set({ saving: false });
  },
}));
