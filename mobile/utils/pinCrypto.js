import * as Crypto from 'expo-crypto';

const PIN_ITERATIONS = 120000;

export async function generatePinSalt() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPin(pin, salt) {
  if (!pin || !salt) return null;
  const payload = `${String(pin)}:${String(salt)}:${PIN_ITERATIONS}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
}

export async function buildSessionPinPayload(standardPin, duressPin, salt) {
  const resolvedSalt = salt || (await generatePinSalt());
  const [standardPinHash, duressPinHash] = await Promise.all([
    hashPin(standardPin, resolvedSalt),
    hashPin(duressPin, resolvedSalt),
  ]);

  return {
    pinSalt: resolvedSalt,
    standardPinHash,
    duressPinHash,
  };
}

export async function hashPinForDisarm(enteredPin, salt) {
  return hashPin(enteredPin, salt);
}
