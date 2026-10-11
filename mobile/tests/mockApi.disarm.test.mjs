import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mockApi } from '../services/mockApi.js';

describe('mockApi disarm authorization', () => {
  it('requires matching disarmToken for BIOMETRIC disarm', async () => {
    const session = await mockApi.startSession({
      mode: 'GEOFENCE',
      contact1: '+919876543210',
      contact2: '+919123456789',
    });

    await assert.rejects(
      () =>
        mockApi.disarmSession({
          sessionId: session.sessionId,
          method: 'BIOMETRIC',
          disarmToken: 'wrong-token',
        }),
      /Invalid disarm token/
    );

    const ok = await mockApi.disarmSession({
      sessionId: session.sessionId,
      method: 'BIOMETRIC',
      disarmToken: session.disarmToken,
    });
    assert.equal(ok.success, true);
  });
});
