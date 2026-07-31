const crypto = require('crypto');

const PIN_ITERATIONS = 120000;

function hashPin(pin, salt) {
  if (!pin || !salt) return null;
  const payload = `${String(pin)}:${String(salt)}:${PIN_ITERATIONS}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function secureCompare(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function generatePinSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function generateDisarmToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verifyPinHash(pinHash, standardPinHash, duressPinHash) {
  if (pinHash && standardPinHash && secureCompare(pinHash, standardPinHash)) {
    return 'STANDARD';
  }
  if (pinHash && duressPinHash && secureCompare(pinHash, duressPinHash)) {
    return 'DURESS';
  }
  return null;
}

module.exports = {
  hashPin,
  secureCompare,
  generatePinSalt,
  generateDisarmToken,
  verifyPinHash,
  PIN_ITERATIONS,
};
