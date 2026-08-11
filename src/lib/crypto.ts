import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.N8N_BRIDGE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('N8N_BRIDGE_ENCRYPTION_KEY is not set');
  }

  // Accept 64-char hex or standard base64 for a 32-byte key; otherwise derive via sha256.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    // fall through
  }
  return createHash('sha256').update(raw).digest();
}

/** Encrypt plaintext; returns `iv:tag:ciphertext` hex bundle. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid encrypted payload format');
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
