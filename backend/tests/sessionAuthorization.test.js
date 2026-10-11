const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { guardianPhonesRegistered, userMayAccessSession } = require('../lib/sessionAuthorization');

describe('guardianPhonesRegistered', () => {
  it('requires both contacts to exist on the account', () => {
    const contacts = [{ phone_e164: '+919876543210' }, { phone_e164: '+919123456789' }];
    assert.equal(guardianPhonesRegistered(contacts, '+919876543210', '+919123456789'), true);
    assert.equal(guardianPhonesRegistered(contacts, '+919876543210', '+100000000000'), false);
  });
});

describe('userMayAccessSession', () => {
  it('denies cross-user access when session has an owner', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    assert.equal(userMayAccessSession({ userId: 'user-a' }, 'user-b'), false);
    assert.equal(userMayAccessSession({ userId: 'user-a' }, 'user-a'), true);
    process.env.NODE_ENV = prev;
  });
});
