const crypto = require('crypto');

// Set a test encryption key before requiring the module
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

const { encrypt, decrypt, deriveKey } = require('../src/utils/encryption');

describe('encryption utility', () => {
  describe('deriveKey', () => {
    it('should return a 32-byte key buffer', async () => {
      const salt = crypto.randomBytes(16);
      const key = await deriveKey(salt);
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    it('should derive the same key for the same salt', async () => {
      const salt = crypto.randomBytes(16);
      const key1 = await deriveKey(salt);
      const key2 = await deriveKey(salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys for different salts', async () => {
      const salt1 = crypto.randomBytes(16);
      const salt2 = crypto.randomBytes(16);
      const key1 = await deriveKey(salt1);
      const key2 = await deriveKey(salt2);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encrypt', () => {
    it('should return an async result (promise)', () => {
      const result = encrypt('test');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return a string with salt:iv:ciphertext:tag format', async () => {
      const encrypted = await encrypt('hello world');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      // salt = 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // iv = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // ciphertext should be non-empty hex
      expect(parts[2].length).toBeGreaterThan(0);
      // auth tag = 16 bytes = 32 hex chars
      expect(parts[3]).toHaveLength(32);
    });

    it('should produce different ciphertexts for the same plaintext (random salt/iv)', async () => {
      const encrypted1 = await encrypt('same text');
      const encrypted2 = await encrypt('same text');
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should return an async result (promise)', async () => {
      const encrypted = await encrypt('test');
      const result = decrypt(encrypted);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should correctly round-trip encrypt then decrypt', async () => {
      const plaintext = 'sensitive patient data 123-45-6789';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const encrypted = await encrypt('');
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', async () => {
      const plaintext = 'Patient: Jose Garcia-Lopez';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should reject tampered ciphertext', async () => {
      const encrypted = await encrypt('test data');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = 'ff' + parts[2].slice(2);
      const tampered = parts.join(':');
      await expect(decrypt(tampered)).rejects.toThrow();
    });
  });

  describe('non-blocking behavior', () => {
    it('should not block the event loop during key derivation', async () => {
      const iterations = 5;
      let eventLoopTicks = 0;

      // Count event loop ticks while encryption is running
      const interval = setInterval(() => { eventLoopTicks++; }, 1);

      const promises = [];
      for (let i = 0; i < iterations; i++) {
        promises.push(encrypt(`data-${i}`));
      }
      await Promise.all(promises);

      clearInterval(interval);

      // If pbkdf2 were synchronous, the event loop would be blocked
      // and eventLoopTicks would be 0 or very low.
      // With async pbkdf2, the event loop stays responsive.
      expect(eventLoopTicks).toBeGreaterThan(0);
    });
  });
});
