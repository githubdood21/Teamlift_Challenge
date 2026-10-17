import { Injectable } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { randomBytes, createHash } from 'node:crypto';

export const CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.freebusy';
export type BusyPeriod = { start: string; end: string };
type FreeBusyResponse = {
  calendars?: Record<string, { busy?: BusyPeriod[]; errors?: unknown[] }>;
};

export function missingCalendarConfig(): string[] {
  const missing = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ].filter((name) => !process.env[name]?.trim());
  if (
    !/^[a-f0-9]{64}$/i.test(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ?? '')
  ) {
    missing.push('CALENDAR_TOKEN_ENCRYPTION_KEY');
  }
  return missing;
}

@Injectable()
export class GoogleCalendarClient {
  private cached?: { refreshToken: string; client: OAuth2Client };

  private oauth(): OAuth2Client {
    if (missingCalendarConfig().length)
      throw new Error('Calendar setup is incomplete');
    const redirect = new URL(process.env.GOOGLE_REDIRECT_URI!);
    if (
      redirect.protocol !== 'https:' &&
      !(
        redirect.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(redirect.hostname)
      )
    ) {
      throw new Error('Calendar redirect must use HTTPS or localhost');
    }
    return new OAuth2Client({
      transporterOptions: { timeout: 10000, retry: false },
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: redirect.toString(),
    });
  }

  authorization(state: string) {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    return {
      verifier,
      url: this.oauth().generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [CALENDAR_SCOPE],
        state,
        code_challenge: challenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    };
  }

  async exchange(code: string, verifier: string): Promise<string> {
    const result = await this.oauth().getToken({
      code,
      codeVerifier: verifier,
    });
    if (
      !result.tokens.refresh_token ||
      !result.tokens.scope?.split(' ').includes(CALENDAR_SCOPE)
    ) {
      throw new Error('Calendar permission or offline access was not granted');
    }
    return result.tokens.refresh_token;
  }

  async busy(
    refreshToken: string,
    start: Date,
    end: Date,
  ): Promise<BusyPeriod[]> {
    if (!this.cached || this.cached.refreshToken !== refreshToken) {
      const client = this.oauth();
      client.setCredentials({ refresh_token: refreshToken });
      this.cached = { refreshToken, client };
    }
    const result = await this.cached.client.request<FreeBusyResponse>({
      url: 'https://www.googleapis.com/calendar/v3/freeBusy',
      method: 'POST',
      timeout: 10000,
      retry: false,
      data: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      },
    });
    const calendar = result.data.calendars?.primary;
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy))
      throw new Error('Calendar availability unavailable');
    for (const period of calendar.busy) {
      if (
        !Number.isFinite(Date.parse(period.start)) ||
        !Number.isFinite(Date.parse(period.end)) ||
        Date.parse(period.start) >= Date.parse(period.end)
      )
        throw new Error('Invalid busy period');
    }
    return calendar.busy;
  }

  async revoke(refreshToken: string): Promise<void> {
    this.cached = undefined;
    await new OAuth2Client({
      transporterOptions: { timeout: 10000, retry: false },
    }).revokeToken(refreshToken);
  }
}
