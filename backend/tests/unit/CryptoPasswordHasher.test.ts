import { describe, it, expect } from 'vitest';
import { CryptoPasswordHasher } from '../../src/infrastructure/security/CryptoPasswordHasher.js';

describe('CryptoPasswordHasher', () => {
  const hasher = new CryptoPasswordHasher();

  it('should hash a password and produce a salt:key format', async () => {
    const hash = await hasher.hash('myPassword123');
    expect(hash).toContain(':');
    const [salt, key] = hash.split(':');
    expect(salt.length).toBe(32); // 16 bytes hex
    expect(key.length).toBe(128); // 64 bytes hex
  });

  it('should produce different hashes for the same password (unique salts)', async () => {
    const hash1 = await hasher.hash('samePassword');
    const hash2 = await hasher.hash('samePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('should verify a correct password against its hash', async () => {
    const password = 'securePass!456';
    const hash = await hasher.hash(password);
    const result = await hasher.verify(password, hash);
    expect(result).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hasher.hash('correctPassword');
    const result = await hasher.verify('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('should return false for malformed hash strings', async () => {
    const result = await hasher.verify('any', 'not-a-valid-hash');
    expect(result).toBe(false);
  });
});
