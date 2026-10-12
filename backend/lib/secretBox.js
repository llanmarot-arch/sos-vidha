const crypto = require('crypto');

/** AES-256-GCM for incident capabilities. The key is 32 bytes, supplied as 64 hex characters. */
function createSecretBox(keyHex) {
  const key = Buffer.from(String(keyHex || ''), 'hex');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters');
  }

  return {
    encrypt(plaintext) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
    },

    decrypt(payload) {
      const parts = String(payload || '').split('.');
      if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Unrecognized secret');
      }
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64url'));
      decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
    },
  };
}

module.exports = { createSecretBox };
