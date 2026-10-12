import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomHex } from '../services/incidents/sessionSecrets.js';

describe('session disarm secrets', () => {
  it('creates a long random secret and never a fixed demo PIN', () => {
    const a = randomHex(32);
    const b = randomHex(32);
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.match(b, /^[0-9a-f]{64}$/);
    assert.notEqual(a, b);
    assert.notEqual(a, '1234');
    assert.notEqual(b, '9999');
  });

  it('refuses a short secret', () => {
    assert.throws(() => randomHex(4), /short secret/);
  });
});
