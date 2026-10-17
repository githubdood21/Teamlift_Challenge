import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { CalendarConnection, CalendarOAuthAttempt } from './calendar.entity.js';
import { decrypt, digest, encrypt, equalSecrets } from './calendar-security.js';
import {
  GoogleCalendarClient,
  missingCalendarConfig,
} from './google-calendar.client.js';
import type { BusyPeriod } from './google-calendar.client.js';
import type { Slot } from '../slots/slot.entity.js';

export function overlaps(
  slot: Pick<Slot, 'startsAt' | 'durationMinutes'>,
  period: BusyPeriod,
): boolean {
  const start = slot.startsAt.getTime();
  return (
    start < Date.parse(period.end) &&
    start + slot.durationMinutes * 60000 > Date.parse(period.start)
  );
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarConnection)
    private readonly connections: Repository<CalendarConnection>,
    @InjectRepository(CalendarOAuthAttempt)
    private readonly attempts: Repository<CalendarOAuthAttempt>,
    @Inject(GoogleCalendarClient) private readonly google: GoogleCalendarClient,
  ) {}

  async status() {
    const connection = await this.connections.findOneBy({ id: 1 });
    const missing = missingCalendarConfig();
    return {
      connected: Boolean(connection),
      configured: missing.length === 0,
      missing,
      connectedAt: connection?.connectedAt ?? null,
      calendar: 'primary',
    };
  }

  async begin() {
    if (missingCalendarConfig().length)
      throw new ServiceUnavailableException('Calendar setup is incomplete');
    const state = randomBytes(32).toString('base64url');
    const authorization = this.google.authorization(state);
    await this.attempts.delete({ expiresAt: LessThan(new Date()) });
    await this.attempts.save({
      stateHash: digest(state),
      verifierCipher: encrypt(authorization.verifier),
      expiresAt: new Date(Date.now() + 10 * 60000),
    });
    return { state, url: authorization.url };
  }

  async busyPeriods(start: Date, end: Date) {
    const duration = end.getTime() - start.getTime();
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 32 * 86400000
    ) {
      throw new BadRequestException(
        'Choose a calendar range of at most 32 days',
      );
    }
    const connection = await this.connections.findOneBy({ id: 1 });
    const periods = connection
      ? await this.loadBusy(connection, start, end)
      : [];
    // The public demo exposes only normalized intervals within the selected range.
    return {
      connected: Boolean(connection),
      source: 'google-calendar',
      checkedAt: new Date().toISOString(),
      periods: periods
        .map((period) => ({
          start: new Date(
            Math.max(start.getTime(), Date.parse(period.start)),
          ).toISOString(),
          end: new Date(
            Math.min(end.getTime(), Date.parse(period.end)),
          ).toISOString(),
        }))
        .filter((period) => Date.parse(period.start) < Date.parse(period.end))
        .sort(
          (left, right) => Date.parse(left.start) - Date.parse(right.start),
        ),
    };
  }

  private async loadBusy(
    connection: CalendarConnection,
    start: Date,
    end: Date,
  ): Promise<BusyPeriod[]> {
    try {
      return await this.google.busy(
        decrypt(connection.refreshTokenCipher),
        start,
        end,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Calendar availability cannot be checked. Please try again shortly.',
      );
    }
  }

  async complete(
    state: string,
    cookieState: string,
    code?: string,
    denied = false,
  ): Promise<void> {
    if (!state || !cookieState || !equalSecrets(state, cookieState))
      throw new BadRequestException('Invalid calendar authorization state');
    const attempt = await this.attempts.findOneBy({ stateHash: digest(state) });
    if (!attempt || attempt.expiresAt.getTime() <= Date.now())
      throw new BadRequestException('Calendar authorization expired');
    const consumed = await this.attempts.delete({
      stateHash: attempt.stateHash,
    });
    if (consumed.affected !== 1)
      throw new BadRequestException('Calendar authorization already used');
    if (denied || !code)
      throw new BadRequestException('Calendar authorization not granted');
    const refreshToken = await this.google.exchange(
      code,
      decrypt(attempt.verifierCipher),
    );
    await this.connections.save({
      id: 1,
      refreshTokenCipher: encrypt(refreshToken),
      connectedAt: new Date(),
    });
  }

  async disconnect() {
    const connection = await this.connections.findOneBy({ id: 1 });
    await this.connections.delete({ id: 1 });
    await this.attempts.clear();
    let revoked = true;
    if (connection) {
      try {
        await this.google.revoke(decrypt(connection.refreshTokenCipher));
      } catch {
        revoked = false;
      }
    }
    return { connected: false, revoked };
  }

  async filterAvailable<T extends Slot>(
    slots: T[],
    manager?: EntityManager,
  ): Promise<T[]> {
    if (!slots.length) return slots;
    // A booking must reuse its transaction connection: opening another pooled
    // connection while other requests wait on the slot lock can exhaust the pool.
    const repository = manager
      ? manager.getRepository(CalendarConnection)
      : this.connections;
    const connection = await repository.findOneBy({ id: 1 });
    if (!connection) return slots;
    const start = new Date(
      Math.min(...slots.map((slot) => slot.startsAt.getTime())),
    );
    const end = new Date(
      Math.max(
        ...slots.map(
          (slot) => slot.startsAt.getTime() + slot.durationMinutes * 60000,
        ),
      ),
    );
    const periods = await this.loadBusy(connection, start, end);
    return slots.filter(
      (slot) => !periods.some((period) => overlaps(slot, period)),
    );
  }

  async assertAvailable(slot: Slot, manager?: EntityManager): Promise<void> {
    if (!(await this.filterAvailable([slot], manager)).length) {
      throw new ConflictException(
        'This time conflicts with the host’s calendar. Please choose another slot.',
      );
    }
  }
}
