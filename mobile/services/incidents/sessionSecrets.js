/** Random disarm material for a session. Not a user-chosen PIN and never a fixed demo value. */

function fillRandom(bytes) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('A cryptographic random source is not available on this device.');
  }
  cryptoApi.getRandomValues(bytes);
}

export function randomHex(byteLength) {
  const size = Number(byteLength);
  if (!Number.isInteger(size) || size < 16) {
    throw new Error('Refusing to generate a short secret.');
  }
  const bytes = new Uint8Array(size);
  fillRandom(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
