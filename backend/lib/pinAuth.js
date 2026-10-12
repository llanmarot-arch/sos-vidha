const crypto = require('crypto');

/** Legacy client hashes used this number as a string inside a single SHA-256. It was not a slow hash. */
const PIN_ITERATIONS = 120000;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const PIN_RE = /^[0-9A-Za-z]{4,128}$/;
const SCRYPT_RE = /^scrypt1\$16384\$8\$1\$([0-9a-fA-F]{64})$/;

/**
 * Slow PIN hash (Node crypto.scrypt, N=16384). Stored as scrypt1$N$r$p$hex.
 * Existing 64-hex SHA-256 client hashes still verify; they are not rewritten until the next PIN entry.
 */
function hashPin(pin, salt) {
  if (pin == null || salt == null || pin === '' || salt === '') return null;
  const hash = crypto.scryptSync(String(pin), String(salt), SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt1$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${hash.toString('hex')}`;
}

/** Even-length hex only. Node's hex decoder drops trailing junk, which must not count as a match. */
function isEvenHex(value) {
  return typeof value === 'string' && value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

function secureCompare(a, b) {
  if (!isEvenHex(a) || !isEvenHex(b) || a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== a.length / 2 || bufB.length !== b.length / 2) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generatePinSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function generateDisarmToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashMaterial(value) {
  if (typeof value !== 'string' || !value) return null;
  const scrypt = SCRYPT_RE.exec(value);
  if (scrypt) return { version: 'scrypt1', hex: scrypt[1].toLowerCase() };
  if (/^[0-9a-fA-F]{64}$/.test(value)) return { version: 'raw', hex: value.toLowerCase() };
  return null;
}

function verifyPinHash(pinHash, standardPinHash, duressPinHash) {
  const candidate = hashMaterial(pinHash);
  if (!candidate) return null;
  const standard = hashMaterial(standardPinHash);
  const duress = hashMaterial(duressPinHash);
  if (standard && candidate.version === standard.version && secureCompare(candidate.hex, standard.hex)) {
    return 'STANDARD';
  }
  if (duress && candidate.version === duress.version && secureCompare(candidate.hex, duress.hex)) {
    return 'DURESS';
  }
  return null;
}

function resolveSessionPins(body) {
  const source = body || {};
  const pinSalt =
    typeof source.pinSalt === 'string' && /^[0-9a-fA-F]{8,128}$/.test(source.pinSalt)
      ? source.pinSalt.toLowerCase()
      : generatePinSalt();
  if (source.standardPin != null || source.duressPin != null) {
    const standardPin = source.standardPin;
    const duressPin = source.duressPin;
    if (typeof standardPin !== 'string' || typeof duressPin !== 'string' || !PIN_RE.test(standardPin) || !PIN_RE.test(duressPin)) {
      return { error: 'PIN must be 4 to 128 letters or digits' };
    }
    if (standardPin === duressPin) {
      return { error: 'The regular PIN and duress PIN must be different' };
    }
    return {
      pinSalt,
      standardPinHash: hashPin(standardPin, pinSalt),
      duressPinHash: hashPin(duressPin, pinSalt),
    };
  }
  const pinHashRe = /^[0-9a-fA-F]{64}$/;
  if (!pinHashRe.test(String(source.standardPinHash || '')) || !pinHashRe.test(String(source.duressPinHash || ''))) {
    return { error: 'standardPinHash and duressPinHash must be 64 hex characters' };
  }
  if (secureCompare(String(source.standardPinHash), String(source.duressPinHash))) {
    return { error: 'The regular PIN and duress PIN must be different' };
  }
  return {
    pinSalt,
    standardPinHash: String(source.standardPinHash).toLowerCase(),
    duressPinHash: String(source.duressPinHash).toLowerCase(),
  };
}

/**
 * A scrypt hash stored for a new session is not a bearer token: the request must carry the PIN.
 * Legacy 64-hex hashes still match a client-supplied pinHash.
 */
function pinTypeForDisarm({ pin, pinHash, pinSalt, standardPinHash, duressPinHash }) {
  if (typeof pin === 'string' && pin.length > 0) {
    return verifyPinHash(hashPin(pin, pinSalt), standardPinHash, duressPinHash);
  }
  if (typeof standardPinHash === 'string' && standardPinHash.startsWith('scrypt1$')) return null;
  if (pinHash) return verifyPinHash(pinHash, standardPinHash, duressPinHash);
  return null;
}

module.exports = {
  hashPin,
  secureCompare,
  generatePinSalt,
  generateDisarmToken,
  verifyPinHash,
  resolveSessionPins,
  pinTypeForDisarm,
  PIN_ITERATIONS,
};
