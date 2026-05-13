// MUST set ENCRYPTION_KEY before the module is loaded — the module captures
// KEY_HEX at import time via `const KEY_HEX = process.env.ENCRYPTION_KEY ?? ''`.
const TEST_KEY = 'a'.repeat(64); // 64 valid hex chars = 32 bytes, AES-256 key
process.env.ENCRYPTION_KEY = TEST_KEY;

// eslint-disable-next-line import/first
import { encryptSIN, decryptSIN } from '../utils/crypto';

describe('encryptSIN / decryptSIN', () => {
  const testSIN = '123456789';

  it('encryptSIN returns a string different from the plaintext input', () => {
    const ciphertext = encryptSIN(testSIN);
    expect(typeof ciphertext).toBe('string');
    expect(ciphertext).not.toBe(testSIN);
  });

  it('encryptSIN output contains the IV:ciphertext format (contains a colon)', () => {
    const ciphertext = encryptSIN(testSIN);
    expect(ciphertext).toContain(':');
    const parts = ciphertext.split(':');
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32);
    // ciphertext portion is non-empty
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('decryptSIN(encryptSIN(sin)) returns the original SIN', () => {
    const encrypted = encryptSIN(testSIN);
    const decrypted = decryptSIN(encrypted);
    expect(decrypted).toBe(testSIN);
  });

  it('round-trips correctly for a SIN with dashes', () => {
    const sinWithDashes = '123-456-789';
    const encrypted = encryptSIN(sinWithDashes);
    expect(decryptSIN(encrypted)).toBe(sinWithDashes);
  });

  it('two calls to encryptSIN with the same SIN produce different ciphertext (random IVs)', () => {
    const first = encryptSIN(testSIN);
    const second = encryptSIN(testSIN);
    // They must not be identical because each call uses a fresh random IV
    expect(first).not.toBe(second);
  });

  it('both different ciphertexts still decrypt to the same original SIN', () => {
    const first = encryptSIN(testSIN);
    const second = encryptSIN(testSIN);
    expect(decryptSIN(first)).toBe(testSIN);
    expect(decryptSIN(second)).toBe(testSIN);
  });

  it('decryptSIN with tampered IV portion throws', () => {
    const encrypted = encryptSIN(testSIN);
    const [, cipherHex] = encrypted.split(':');
    // Replace IV with all-zeros hex — decryption will produce garbage and padding check fails
    const tampered = `${'0'.repeat(32)}:${cipherHex}`;
    expect(() => decryptSIN(tampered)).toThrow();
  });

  it('decryptSIN with tampered ciphertext portion throws', () => {
    const encrypted = encryptSIN(testSIN);
    const [ivHex] = encrypted.split(':');
    // Replace ciphertext with garbage hex of same length (32 bytes = 64 hex chars)
    const fakeCipher = 'deadbeef'.repeat(8);
    const tampered = `${ivHex}:${fakeCipher}`;
    expect(() => decryptSIN(tampered)).toThrow();
  });

  it('decryptSIN with completely invalid format (no colon) throws', () => {
    expect(() => decryptSIN('notvalidatall')).toThrow();
  });

  it('decryptSIN with empty string throws', () => {
    expect(() => decryptSIN('')).toThrow();
  });

  it('decryptSIN with missing ciphertext part (colon present but empty data) throws', () => {
    // "ivhex:" — dataHex is empty string which is falsy
    expect(() => decryptSIN(`${'a'.repeat(32)}:`)).toThrow();
  });
});

describe('getKey validation', () => {
  afterEach(() => {
    // Restore valid key after each test in this group
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  it('encryptSIN throws when ENCRYPTION_KEY is not set', () => {
    // We need a fresh module load with no key set.
    // Since the module is already loaded with the valid key baked in,
    // we test this by temporarily patching the env and using isolateModules.
    let encryptFn: typeof encryptSIN;
    delete process.env.ENCRYPTION_KEY;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      encryptFn = require('../utils/crypto').encryptSIN;
    });
    expect(() => encryptFn!('test')).toThrow(/ENCRYPTION_KEY/);
  });

  it('encryptSIN throws when ENCRYPTION_KEY is too short', () => {
    let encryptFn: typeof encryptSIN;
    process.env.ENCRYPTION_KEY = 'tooshort';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      encryptFn = require('../utils/crypto').encryptSIN;
    });
    expect(() => encryptFn!('test')).toThrow(/ENCRYPTION_KEY/);
  });
});
