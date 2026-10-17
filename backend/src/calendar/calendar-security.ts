import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function equalSecrets(left: string, right: string): boolean {
  return timingSafeEqual(
    Buffer.from(digest(left), 'hex'),
    Buffer.from(digest(right), 'hex'),
  );
}
export function encryptionKey(): Buffer {
  const value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error('Calendar encryption key is not configured');
  return Buffer.from(value, 'hex');
}
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
export function decrypt(value: string): string {
  const data = Buffer.from(value, 'base64');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    cipher.update(data.subarray(28)),
    cipher.final(),
  ]).toString('utf8');
}
