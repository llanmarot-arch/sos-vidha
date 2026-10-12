import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadRegularPin, saveRegularPin, LEGACY_PIN_KEY, SECURE_PIN_KEY } from '../services/pinStorage.js';

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
    async getItemAsync(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async setItemAsync(key, value) {
      data.set(key, value);
    },
    async deleteItemAsync(key) {
      data.delete(key);
    },
  };
}

describe('regular PIN storage', () => {
  it('moves a legacy AsyncStorage PIN into the secure store and deletes the plaintext copy', async () => {
    const asyncStorage = memoryStore({ [LEGACY_PIN_KEY]: '1234' });
    const secureStore = memoryStore();
    const loaded = await loadRegularPin({ asyncStorage, secureStore });
    assert.equal(loaded.pin, '1234');
    assert.equal(loaded.persisted, true);
    assert.equal(asyncStorage.data.has(LEGACY_PIN_KEY), false);
    assert.equal(secureStore.data.get(SECURE_PIN_KEY), '1234');
  });

  it('drops the plaintext copy when the secure store cannot keep it, and keeps the PIN for this launch', async () => {
    const asyncStorage = memoryStore({ [LEGACY_PIN_KEY]: '1234' });
    const secureStore = {
      async getItemAsync() {
        return null;
      },
      async setItemAsync() {
        throw new Error('unavailable');
      },
      async deleteItemAsync() {},
    };
    const loaded = await loadRegularPin({ asyncStorage, secureStore });
    assert.equal(loaded.pin, '1234');
    assert.equal(loaded.persisted, false);
    assert.equal(asyncStorage.data.has(LEGACY_PIN_KEY), false);
    const again = await loadRegularPin({ asyncStorage, secureStore });
    assert.equal(again.pin, '');
  });

  it('never writes a new PIN to AsyncStorage', async () => {
    const asyncStorage = memoryStore({ [LEGACY_PIN_KEY]: '9999' });
    const secureStore = memoryStore();
    const saved = await saveRegularPin('1234', { asyncStorage, secureStore });
    assert.equal(saved.persisted, true);
    assert.equal(asyncStorage.data.has(LEGACY_PIN_KEY), false);
    assert.equal(secureStore.data.get(SECURE_PIN_KEY), '1234');
  });
});
