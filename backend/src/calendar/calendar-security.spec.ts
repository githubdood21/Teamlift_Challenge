import { randomBytes } from 'node:crypto';
import { decrypt, encrypt, equalSecrets } from './calendar-security.js';
import { overlaps } from './calendar.service.js';

afterEach(() => vi.unstubAllEnvs());

it('encrypts with a random nonce and detects tampering', () => {
  vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
  const first = encrypt('test-refresh-token');
  expect(first).not.toBe(encrypt('test-refresh-token'));
  expect(first).not.toContain('test-refresh-token');
  expect(decrypt(first)).toBe('test-refresh-token');
  const damaged = Buffer.from(first, 'base64');
  damaged[damaged.length - 1] ^= 1;
  expect(() => decrypt(damaged.toString('base64'))).toThrow();
});

it('rejects missing encryption setup and compares different-length secrets safely', () => {
  vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', '');
  expect(() => encrypt('test')).toThrow();
  expect(equalSecrets('a', 'longer')).toBe(false);
  expect(equalSecrets('same', 'same')).toBe(true);
});

it('detects partial calendar conflicts without blocking adjacent meetings', () => {
  const slot = {
    startsAt: new Date('2030-01-01T10:00:00Z'),
    durationMinutes: 30,
  };
  expect(
    overlaps(slot, {
      start: '2030-01-01T09:45:00Z',
      end: '2030-01-01T10:15:00Z',
    }),
  ).toBe(true);
  expect(
    overlaps(slot, {
      start: '2030-01-01T10:30:00Z',
      end: '2030-01-01T11:00:00Z',
    }),
  ).toBe(false);
  expect(
    overlaps(slot, {
      start: '2030-01-01T09:00:00Z',
      end: '2030-01-01T10:00:00Z',
    }),
  ).toBe(false);
});
