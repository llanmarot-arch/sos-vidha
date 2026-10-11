import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Native storage for incident records: Keychain (iOS) / Keystore-encrypted prefs (Android).
 * If the secure store rejects a write, the record is kept in app-private AsyncStorage instead, because
 * losing an SOS record is worse than storing it unencrypted inside the app sandbox.
 */
const OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const FALLBACK_PREFIX = '@sosvidha/secure-fallback/';

export const incidentStorage = {
  async getItem(key) {
    try {
      const value = await SecureStore.getItemAsync(key, OPTIONS);
      if (value != null) return value;
    } catch {
      /* fall through to the fallback copy */
    }
    return AsyncStorage.getItem(FALLBACK_PREFIX + key);
  },

  async setItem(key, value) {
    try {
      await SecureStore.setItemAsync(key, value, OPTIONS);
      AsyncStorage.removeItem(FALLBACK_PREFIX + key).catch(() => {});
    } catch {
      await AsyncStorage.setItem(FALLBACK_PREFIX + key, value);
    }
  },

  async removeItem(key) {
    await Promise.allSettled([SecureStore.deleteItemAsync(key, OPTIONS), AsyncStorage.removeItem(FALLBACK_PREFIX + key)]);
  },
};
