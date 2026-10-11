import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Browsers have no hardware-backed secret store available to this app, so records use localStorage.
 * They contain no tokens, phone numbers or tracking links; location fixes are the sensitive part.
 */
const PREFIX = '@sosvidha/';

export const incidentStorage = {
  getItem: (key) => AsyncStorage.getItem(PREFIX + key),
  setItem: (key, value) => AsyncStorage.setItem(PREFIX + key, value),
  removeItem: (key) => AsyncStorage.removeItem(PREFIX + key),
};
