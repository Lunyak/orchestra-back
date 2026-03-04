import crypto from 'node:crypto';

function getKey(): Buffer {
  const raw = String(process.env.BOT_TOKENS_KEY ?? '').trim();
  if (!raw) {
    throw new Error('BOT_TOKENS_KEY is required (base64, 32 bytes)');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `BOT_TOKENS_KEY must decode to 32 bytes, got ${key.length} bytes`,
    );
  }
  return key;
}

/**
 * Encrypt string with AES-256-GCM.
 * Output format: v1:<iv_b64>:<tag_b64>:<cipher_b64>
 */
export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(String(plain ?? ''), 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptString(payload: string): string {
  const s = String(payload ?? '');
  if (!s.startsWith('v1:')) throw new Error('Unsupported secret-box payload');
  const parts = s.split(':');
  if (parts.length !== 4) throw new Error('Invalid secret-box payload');
  const [, ivB64, tagB64, cipherB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
