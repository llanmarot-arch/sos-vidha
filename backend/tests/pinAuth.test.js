const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { secureCompare, verifyPinHash, hashPin, pinTypeForDisarm } = require('../lib/pinAuth');

const TOKEN = 'ab'.repeat(32);

describe('secureCompare', () => {
  it('matches an exact hex secret', () => {
    assert.equal(secureCompare(TOKEN, TOKEN), true);
    assert.equal(secureCompare(TOKEN.toUpperCase(), TOKEN), true);
  });

  it('rejects trailing junk, odd length, and non-hex', () => {
    assert.equal(secureCompare(TOKEN + '</script><script>x</script>', TOKEN), false);
    assert.equal(secureCompare(TOKEN + 'ff', TOKEN), false);
    assert.equal(secureCompare(TOKEN + 'f', TOKEN), false);
    assert.equal(secureCompare('zz', 'zz'), false);
    assert.equal(secureCompare('', ''), false);
    assert.equal(secureCompare(TOKEN.slice(0, -2), TOKEN), false);
  });
});

describe('verifyPinHash', () => {
  it('does not accept a stored hash with bytes appended', () => {
    const standard = 'a'.repeat(64);
    const duress = 'b'.repeat(64);
    assert.equal(verifyPinHash(standard + '00', standard, duress), null);
    assert.equal(verifyPinHash(standard, standard, duress), 'STANDARD');
    assert.equal(verifyPinHash(duress, standard, duress), 'DURESS');
  });

  it('stores a slow hash and still accepts a legacy 64-hex hash', () => {
    const salt = 'abc123';
    const stored = hashPin('1234', salt);
    const duress = hashPin('9999', salt);
    assert.match(stored, /^scrypt1\$16384\$8\$1\$[0-9a-f]{64}$/);
    assert.notEqual(stored, crypto.createHash('sha256').update('1234:abc123:120000').digest('hex'));
    assert.equal(verifyPinHash(stored, stored, duress), 'STANDARD');
    assert.equal(verifyPinHash(duress, stored, duress), 'DURESS');
    assert.equal(verifyPinHash('a'.repeat(64), stored, duress), null);
    assert.equal(hashPin('1234', salt), stored);

    const legacy = 'a'.repeat(64);
    assert.equal(verifyPinHash(legacy, legacy, 'b'.repeat(64)), 'STANDARD');
    assert.equal(
      pinTypeForDisarm({
        pinHash: stored,
        pinSalt: salt,
        standardPinHash: stored,
        duressPinHash: duress,
      }),
      null
    );
    assert.equal(
      pinTypeForDisarm({
        pin: '1234',
        pinSalt: salt,
        standardPinHash: stored,
        duressPinHash: duress,
      }),
      'STANDARD'
    );
  });
});
