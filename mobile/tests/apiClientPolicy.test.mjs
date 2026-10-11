import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDevMockEnabledFromEnv,
  validateSessionStartResponse,
  userFacingBackendUnavailableMessage,
} from '../services/apiClientPolicy.js';

describe('isDevMockEnabledFromEnv', () => {
  it('is false unless EXPO_PUBLIC_ALLOW_MOCK_API is true', () => {
    assert.equal(isDevMockEnabledFromEnv({}), false);
    assert.equal(isDevMockEnabledFromEnv({ EXPO_PUBLIC_ALLOW_MOCK_API: 'false' }), false);
    assert.equal(isDevMockEnabledFromEnv({ EXPO_PUBLIC_ALLOW_MOCK_API: 'true' }), true);
    assert.equal(isDevMockEnabledFromEnv({ EXPO_PUBLIC_ALLOW_MOCK_API: 'TRUE' }), true);
  });
});

describe('validateSessionStartResponse', () => {
  it('accepts a complete server session payload', () => {
    const result = validateSessionStartResponse({
      sessionId: 'abc',
      trackingUrl: 'https://example.com/track/abc',
      disarmToken: 'secret-token',
    });
    assert.equal(result.ok, true);
  });

  it('rejects missing disarmToken', () => {
    const result = validateSessionStartResponse({
      sessionId: 'abc',
      trackingUrl: 'https://example.com/track/abc',
    });
    assert.equal(result.ok, false);
  });
});

describe('userFacingBackendUnavailableMessage', () => {
  it('states that no session was created', () => {
    const msg = userFacingBackendUnavailableMessage();
    assert.match(msg, /no session was created/i);
    assert.match(msg, /emergency/i);
  });
});
