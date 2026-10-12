/** Legacy AsyncStorage key. New writes go to the device secure store and this key is removed. */
export const LEGACY_PIN_KEY = '@sosvidha/regular_pin';
export const SECURE_PIN_KEY = 'sosvidha.regular_pin';

/**
 * Loads the Safe Zone PIN.
 * A value found only in AsyncStorage is copied to the secure store and then deleted.
 * If the secure store cannot keep it, the AsyncStorage copy is still deleted and the PIN is
 * returned for this launch only, so it is not left in plaintext. The next launch asks again.
 */
export async function loadRegularPin({ asyncStorage, secureStore }) {
  let secure = null;
  try {
    secure = await secureStore.getItemAsync(SECURE_PIN_KEY);
  } catch {
    secure = null;
  }
  if (secure) {
    await asyncStorage.removeItem(LEGACY_PIN_KEY).catch(() => {});
    return { pin: secure, persisted: true };
  }

  const legacy = await asyncStorage.getItem(LEGACY_PIN_KEY);
  if (!legacy) return { pin: '', persisted: false };

  let persisted = false;
  try {
    await secureStore.setItemAsync(SECURE_PIN_KEY, legacy);
    persisted = (await secureStore.getItemAsync(SECURE_PIN_KEY)) === legacy;
  } catch {
    persisted = false;
  }
  await asyncStorage.removeItem(LEGACY_PIN_KEY);
  return { pin: legacy, persisted };
}

/** Saves the PIN in the secure store. Never writes it back to AsyncStorage. */
export async function saveRegularPin(pin, { asyncStorage, secureStore }) {
  await asyncStorage.removeItem(LEGACY_PIN_KEY);
  if (!pin) {
    try {
      await secureStore.deleteItemAsync(SECURE_PIN_KEY);
    } catch {
      /* nothing stored */
    }
    return { persisted: true };
  }
  try {
    await secureStore.setItemAsync(SECURE_PIN_KEY, pin);
    const check = await secureStore.getItemAsync(SECURE_PIN_KEY);
    return { persisted: check === pin };
  } catch {
    return { persisted: false };
  }
}
