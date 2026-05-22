import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_HEX = process.env.ENCRYPTION_KEY ?? '';

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: openssl rand -hex 32'
    );
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypt a SIN string using AES-256-CBC.
 * Returns a string in the format: <iv_hex>:<ciphertext_hex>
 */
export function encryptSIN(sin: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(sin, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a SIN string encrypted by encryptSIN.
 * Expects format: <iv_hex>:<ciphertext_hex>
 */
export function decryptSIN(encrypted: string): string {
  const key = getKey();
  const [ivHex, dataHex] = encrypted.split(':');
  if (!ivHex || !dataHex) {
    throw new Error('Invalid encrypted SIN format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
