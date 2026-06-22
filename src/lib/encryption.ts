import crypto from 'crypto';

// Encrypts/decrypts each user's own AI provider API key before it touches the
// database (spec §5.3 credential.encrypted_key / encryption_iv).
//
// CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte value, e.g.
// generated with: openssl rand -base64 32
//
// In production this key must live in a real secrets manager (AWS Secrets
// Manager / HashiCorp Vault — spec §15), never in a plain .env file checked
// into source control.

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is not set. See .env.example.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

export interface EncryptedPayload {
  ciphertext: Buffer; // includes the GCM auth tag appended at the end
  iv: Buffer;
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV is the GCM-recommended size
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([encrypted, authTag]), iv };
}

export function decryptSecret(ciphertext: Buffer, iv: Buffer): string {
  const key = getKey();
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  const data = ciphertext.subarray(0, ciphertext.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Used only for display in the UI, e.g. "sk-ant-••••••••3Lm9" (spec mockup pattern).
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return '••••••••';
  return `${plaintext.slice(0, 6)}${'•'.repeat(8)}${plaintext.slice(-4)}`;
}
