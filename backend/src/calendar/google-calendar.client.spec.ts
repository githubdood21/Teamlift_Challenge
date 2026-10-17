import { createHash } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  CALENDAR_SCOPE,
  GoogleCalendarClient,
} from './google-calendar.client.js';

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
  vi.stubEnv(
    'GOOGLE_REDIRECT_URI',
    'http://localhost:3000/api/calendar/callback',
  );
  vi.stubEnv('CALENDAR_TOKEN_ENCRYPTION_KEY', 'a'.repeat(64));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('requests only availability, with offline consent, state, and an S256 PKCE challenge', () => {
  const result = new GoogleCalendarClient().authorization('test-state');
  const params = new URL(result.url).searchParams;
  expect(params.get('scope')).toBe(CALENDAR_SCOPE);
  expect(params.get('state')).toBe('test-state');
  expect(params.get('access_type')).toBe('offline');
  expect(params.get('prompt')).toBe('consent');
  expect(params.get('code_challenge_method')).toBe('S256');
  expect(params.get('code_challenge')).toBe(
    createHash('sha256').update(result.verifier).digest('base64url'),
  );
  expect(result.url).not.toContain(result.verifier);
});

it('rejects a token exchange without the requested scope or an offline token', async () => {
  const exchange = vi.spyOn(OAuth2Client.prototype, 'getToken');
  exchange.mockResolvedValue({
    tokens: { refresh_token: 'test', scope: 'unrelated' },
    res: null,
  });
  await expect(
    new GoogleCalendarClient().exchange('test-code', 'verifier'),
  ).rejects.toThrow();
  exchange.mockResolvedValue({ tokens: { scope: CALENDAR_SCOPE }, res: null });
  await expect(
    new GoogleCalendarClient().exchange('test-code', 'verifier'),
  ).rejects.toThrow();
});

it('rejects invalid calendar callback configurations', () => {
  vi.stubEnv(
    'GOOGLE_REDIRECT_URI',
    'http://public.example/api/calendar/callback',
  );
  expect(() => new GoogleCalendarClient().authorization('state')).toThrow();
});
