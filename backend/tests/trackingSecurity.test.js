const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  isSecureTrackingEnabled,
  isTrackerCapabilityValid,
  userOwnsSession,
  authorizeOwnerSocket,
  authorizeTrackerSocket,
  authorizeSessionRead,
} = require('../lib/trackingSecurity');

function token() {
  return crypto.randomBytes(32).toString('hex');
}

function baseSession(overrides = {}) {
  return {
    sessionId: 'sess-1',
    userId: 'user-a',
    status: 'MONITORING',
    trackerToken: token(),
    trackerRevoked: false,
    ...overrides,
  };
}

describe('isSecureTrackingEnabled', () => {
  it('is true in production without supabase', () => {
    assert.equal(isSecureTrackingEnabled({ NODE_ENV: 'production' }), true);
  });

  it('is false in local dev without supabase', () => {
    assert.equal(isSecureTrackingEnabled({ NODE_ENV: 'development' }), false);
  });
});

describe('authorizeOwnerSocket', () => {
  it('denies owner join without JWT in secure mode', () => {
    const session = baseSession();
    const result = authorizeOwnerSocket(session, null, true);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'AUTH_REQUIRED');
  });

  it('allows owner for their session in secure mode', () => {
    const session = baseSession();
    const result = authorizeOwnerSocket(session, { id: 'user-a' }, true);
    assert.equal(result.allowed, true);
  });

  it('denies a different user in secure mode', () => {
    const session = baseSession();
    const result = authorizeOwnerSocket(session, { id: 'user-b' }, true);
    assert.equal(result.allowed, false);
  });
});

describe('authorizeTrackerSocket', () => {
  it('denies session id alone in secure mode', () => {
    const session = baseSession();
    const result = authorizeTrackerSocket(session, null, true);
    assert.equal(result.allowed, false);
  });

  it('allows valid tracker capability in secure mode', () => {
    const session = baseSession();
    const result = authorizeTrackerSocket(session, session.trackerToken, true);
    assert.equal(result.allowed, true);
    assert.equal(result.role, 'tracker');
  });

  it('denies revoked or ended sessions', () => {
    const ended = baseSession({ status: 'DISARMED' });
    assert.equal(authorizeTrackerSocket(ended, ended.trackerToken, true).allowed, false);
    const revoked = baseSession({ trackerRevoked: true });
    assert.equal(authorizeTrackerSocket(revoked, revoked.trackerToken, true).allowed, false);
  });
});

describe('authorizeSessionRead', () => {
  it('denies unauthorized HTTP reads in secure mode', () => {
    const session = baseSession();
    const result = authorizeSessionRead(session, { user: null, trackerToken: null, secureMode: true });
    assert.equal(result.allowed, false);
  });

  it('allows tracker read with capability only', () => {
    const session = baseSession();
    const result = authorizeSessionRead(session, {
      user: null,
      trackerToken: session.trackerToken,
      secureMode: true,
    });
    assert.equal(result.allowed, true);
    assert.equal(result.mode, 'tracker');
  });
});

describe('isTrackerCapabilityValid', () => {
  it('requires exact capability match', () => {
    const session = baseSession();
    assert.equal(isTrackerCapabilityValid(session, session.trackerToken), true);
    assert.equal(isTrackerCapabilityValid(session, token()), false);
  });
});

describe('userOwnsSession strict mode', () => {
  it('denies sessions without owner in secure mode', () => {
    assert.equal(userOwnsSession({ sessionId: 'x' }, 'user-1', true), false);
  });
});
