import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { CreateSchedulingTables1792195200000 } from './migrations/1792195200000-create-scheduling-tables.js';
import { Slot } from '../slots/slot.entity.js';
import { Booking } from '../bookings/booking.entity.js';
import { CalendarConnection, CalendarOAuthAttempt } from '../calendar/calendar.entity.js';
import { AddCalendar1792260000000 } from './migrations/1792260000000-add-calendar.js';
import { AddConfirmation1792300000000 } from './migrations/1792300000000-add-confirmation.js';

// Resolves to backend/.env from both src/database and dist/database.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export function databaseOptions(): DataSourceOptions {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required. Configure backend/.env or the server environment.');
  }
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }
  return {
    type: 'postgres',
    url,
    entities: [Slot, Booking, CalendarConnection, CalendarOAuthAttempt],
    migrations: [CreateSchedulingTables1792195200000, AddCalendar1792260000000, AddConfirmation1792300000000],
    synchronize: false,
    migrationsRun: false,
    poolSize: 5,
    connectTimeoutMS: 10000,
  };
}
