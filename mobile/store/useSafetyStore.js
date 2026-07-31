import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  CONTACTS: '@sosvidha/contacts',
  REGULAR_PIN: '@sosvidha/regular_pin',
  ACTIVE_SESSION: '@sosvidha/active_session',
};

export const SYSTEM_STATES = {
  IDLE: 'IDLE',
  MONITORING: 'MONITORING',
  WARNING: 'WARNING',
  EMERGENCY: 'EMERGENCY',
  DURESS_ACTIVE: 'DURESS_ACTIVE',
  DISARMED: 'DISARMED',
};

export const useSafetyStore = create((set, get) => ({
  systemState: SYSTEM_STATES.IDLE,
  sessionId: null,
  mode: null,
  trackingUrl: null,
  pinSalt: null,
  disarmToken: null,

  userPhone: '',
  contact1: '',
  contact2: '',
  regularPin: '',

  currentLocation: null,
  geofenceCenter: null,
  geofenceRadiusM: 500,
  geofenceTimerMinutes: 30,

  destination: null,
  routes: [],

  warningMessage: null,
  countdownSeconds: null,
  countdownReason: null,

  setContacts: (userPhone, contact1, contact2) => set({ userPhone, contact1, contact2 }),

  setRegularPin: (regularPin) => set({ regularPin }),

  setSessionCredentials: ({ pinSalt, disarmToken, trackingUrl }) =>
    set({ pinSalt, disarmToken, trackingUrl }),

  setSystemState: (systemState) => set({ systemState }),

  setSession: (sessionId, trackingUrl, mode) =>
    set({
      sessionId,
      trackingUrl,
      mode,
      systemState: SYSTEM_STATES.MONITORING,
    }),

  clearSession: () =>
    set({
      sessionId: null,
      trackingUrl: null,
      mode: null,
      pinSalt: null,
      disarmToken: null,
      systemState: SYSTEM_STATES.IDLE,
      warningMessage: null,
      countdownSeconds: null,
      countdownReason: null,
      routes: [],
      destination: null,
    }),

  setCurrentLocation: (currentLocation) => set({ currentLocation }),

  setGeofence: (geofenceCenter, geofenceRadiusM, geofenceTimerMinutes) =>
    set({ geofenceCenter, geofenceRadiusM, geofenceTimerMinutes }),

  setTransit: (destination, routes) => set({ destination, routes }),

  startWarning: (warningMessage, countdownSeconds, countdownReason) =>
    set({
      systemState: SYSTEM_STATES.WARNING,
      warningMessage,
      countdownSeconds,
      countdownReason: countdownReason ?? null,
    }),

  updateCountdown: (countdownSeconds) => set({ countdownSeconds }),

  clearWarning: () =>
    set({
      warningMessage: null,
      countdownSeconds: null,
      countdownReason: null,
      systemState: SYSTEM_STATES.MONITORING,
    }),

  triggerEmergency: () => set({ systemState: SYSTEM_STATES.EMERGENCY }),

  persistProfile: async () => {
    const { userPhone, contact1, contact2, regularPin } = get();
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.CONTACTS, JSON.stringify({ userPhone, contact1, contact2 })],
      [STORAGE_KEYS.REGULAR_PIN, regularPin],
    ]);
  },

  persistActiveSession: async (sessionMeta) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(sessionMeta));
  },

  clearActiveSessionStorage: async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  },

  loadProfile: async () => {
    const [[, contactsRaw], [, regularPinRaw]] = await AsyncStorage.multiGet([
      STORAGE_KEYS.CONTACTS,
      STORAGE_KEYS.REGULAR_PIN,
    ]);

    if (contactsRaw) {
      set(JSON.parse(contactsRaw));
    }
    if (regularPinRaw) {
      set({ regularPin: regularPinRaw });
    }
  },

  getActiveSessionFromStorage: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return raw ? JSON.parse(raw) : null;
  },
}));
