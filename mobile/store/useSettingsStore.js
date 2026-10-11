import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';
import { readAppearance, writeAppearance, applyLiveAppearance, sanitizeAppearance } from '../theme/appearance';

const STORAGE_KEY = '@sosvidha/system_settings';

const DEFAULTS = {
  apiEndpoint: API_BASE_URL,
  powerButtonTaps: 3,
  shakeSensitivity: 0.65,
  crashSensitivity: 0.75,
  impactDetectionEnabled: true,
  shakeDetectionEnabled: true,
  displayName: '',
  phone: '',
  ...readAppearance(),
};

export const useSettingsStore = create((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  saving: false,

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    const appearance = readAppearance();
    set({ ...DEFAULTS, ...saved, ...appearance, loaded: true });
    applyLiveAppearance(appearance);
  },

  patch: (patch) => set(patch),

  /** Text size and reduced motion apply immediately. Colour choices are stored when settings are saved. */
  setAppearance: (partial) => {
    const live = {};
    const pending = {};
    for (const [key, value] of Object.entries(partial)) {
      if (key === 'textScale' || key === 'reduceMotion') live[key] = value;
      else pending[key] = value;
    }
    if (Object.keys(live).length) {
      const next = writeAppearance(live);
      applyLiveAppearance(next);
      set(live);
    }
    if (Object.keys(pending).length) set(pending);
  },

  saveSettings: async () => {
    set({ saving: true });
    const state = get();
    const appearance = sanitizeAppearance(state);
    const previous = readAppearance();
    writeAppearance(appearance);
    applyLiveAppearance(appearance);
    const payload = {
      apiEndpoint: state.apiEndpoint,
      powerButtonTaps: state.powerButtonTaps,
      shakeSensitivity: state.shakeSensitivity,
      crashSensitivity: state.crashSensitivity,
      impactDetectionEnabled: state.impactDetectionEnabled,
      shakeDetectionEnabled: state.shakeDetectionEnabled,
      displayName: state.displayName,
      phone: state.phone,
      ...appearance,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    set({ saving: false });
    const colorsChanged =
      previous.scheme !== appearance.scheme ||
      previous.accent !== appearance.accent ||
      previous.highContrast !== appearance.highContrast;
    return { colorsChanged };
  },
}));
