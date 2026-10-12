import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';
import {
  readAppearance,
  storeAppearance,
  applyLiveAppearance,
  sanitizeAppearance,
  hasStoredAppearance,
  mergeLoadedAppearance,
  reduceAppearance,
} from '../theme/appearance';
import { applyDocumentLocale, hasStoredLocale, readLocale, resolveLoadedLocale, storeLocale } from '../i18n/locale';
import { sanitizeLocale } from '../i18n/translate';

const STORAGE_KEY = '@sosvidha/system_settings';

const DEFAULTS = {
  apiEndpoint: API_BASE_URL,
  displayName: '',
  phone: '',
  locale: readLocale(),
  ...readAppearance(),
};

let hydrationSeq = 0;

function settingsPayload(state) {
  return {
    apiEndpoint: state.apiEndpoint,
    displayName: state.displayName,
    phone: state.phone,
    locale: sanitizeLocale(state.locale),
    ...sanitizeAppearance(state),
  };
}

export const useSettingsStore = create((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  saving: false,

  loadSettings: async () => {
    if (get().loaded) return;
    const seq = hydrationSeq;
    let saved = {};
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : {};
    } catch {
      saved = {};
    }
    if (seq !== hydrationSeq || get().loaded) return;
    const appearance = mergeLoadedAppearance(saved, readAppearance(), hasStoredAppearance());
    const locale = resolveLoadedLocale(saved.locale, hasStoredLocale());
    storeAppearance(appearance);
    storeLocale(locale);
    applyLiveAppearance(appearance);
    applyDocumentLocale(locale);
    set({
      apiEndpoint: typeof saved.apiEndpoint === 'string' && saved.apiEndpoint ? saved.apiEndpoint : DEFAULTS.apiEndpoint,
      displayName: typeof saved.displayName === 'string' ? saved.displayName : '',
      phone: typeof saved.phone === 'string' ? saved.phone : '',
      ...appearance,
      locale,
      loaded: true,
    });
  },

  setLocale: (locale) => {
    hydrationSeq += 1;
    const next = storeLocale(locale);
    applyDocumentLocale(next);
    set({ locale: next, loaded: true });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsPayload(get()))).catch(() => {});
  },

  patch: (patch) => set(patch),

  /** Scheme, accent, contrast, text size, and reduced motion apply and persist immediately. */
  setAppearance: (partial) => {
    hydrationSeq += 1;
    const next = reduceAppearance(get(), partial);
    storeAppearance(next);
    applyLiveAppearance(next);
    set({ ...next, loaded: true });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsPayload(get()))).catch(() => {});
  },

  saveSettings: async () => {
    set({ saving: true });
    const state = get();
    const appearance = sanitizeAppearance(state);
    storeAppearance(appearance);
    applyLiveAppearance(appearance);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsPayload(state)));
    set({ saving: false, ...appearance });
    return { colorsChanged: false };
  },
}));
