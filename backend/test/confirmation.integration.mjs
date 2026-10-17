import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { databaseOptions } from '../dist/database/database-options.js';
import { GeminiClient, STANDARD_CONFIRMATION } from '../dist/confirmation/gemini.client.js';
import { Booking } from '../dist/bookings/booking.entity.js';
import { Slot } from '../dist/slots/slot.entity.js';

// Real PostgreSQL in a disposable schema; no real calendar or Gemini calls.
void describe('Optional booking confirmations', { timeout: 60000 }, () => {
  const schema = 'confirmation_test_' + randomBytes(8).toString('hex');
  let admin, database, app, calls = 0, fallback = false;
  const client = { generate: async details => {
    calls++;
    assert.deepEqual(Object.keys(details).sort(), ['durationMinutes', 'startsAt']);
    await new Promise(resolve => setTimeout(resolve, 30));
    return fallback ? { message: STANDARD_CONFIRMATION, source: 'standard' }
      : { message: 'Your time is reserved. See you soon!', source: 'ai' };
  } };
  const http = () => request(app.getHttpServer());
  const path = booking => `/api/slots/${booking.slotId}/bookings/${booking.id}/confirmation`;
  async function fixture() {
    const slot = await database.getRepository(Slot).save({ startsAt: new Date(Date.now() + 86400000), durationMinutes: 30 });
    return database.getRepository(Booking).save({ slotId: slot.id, name: 'Private attendee', email: 'private@example.com' });
  }
  before(async () => {
    admin = new DataSource(databaseOptions());
    await admin.initialize();
    await admin.query('CREATE SCHEMA ' + schema);
    database = new DataSource({ ...databaseOptions(), schema, extra: { options: '-c search_path=' + schema } });
    await database.initialize();
    await database.runMigrations();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource).useValue(database)
      .overrideProvider(GeminiClient).useValue(client).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  after(async () => {
    if (app) await app.close();
    else if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
      await admin.destroy();
    }
  });
  void it('validates receipt identifiers and rejects unknown or mismatched bookings', async () => {
    const booking = await fixture();
    await http().post('/api/slots/bad/bookings/bad/confirmation').expect(400);
    await http().post(path({ ...booking, id: randomUUID() })).expect(404);
    await http().post(path({ ...booking, slotId: randomUUID() })).expect(404);
    assert.equal(calls, 0);
  });
  void it('deduplicates simultaneous requests and persists the first message for retries', async () => {
    const booking = await fixture();
    const before = calls;
    const responses = await Promise.all(Array.from({ length: 4 }, () => http().post(path(booking)).expect(200)));
    assert.equal(calls - before, 1);
    for (const response of responses) assert.equal(response.body.source, 'ai');
    const saved = await database.getRepository(Booking).findOneByOrFail({ id: booking.id });
    assert.equal(saved.confirmationMessage, responses[0].body.message);
    await http().post(path(booking)).expect(200);
    assert.equal(calls - before, 1);
  });
  void it('saves a standard fallback without changing the already confirmed reservation', async () => {
    fallback = true;
    const booking = await fixture();
    const response = await http().post(path(booking)).expect(200);
    assert.deepEqual(response.body, { message: STANDARD_CONFIRMATION, source: 'standard' });
    const saved = await database.getRepository(Booking).findOneByOrFail({ id: booking.id });
    assert.equal(saved.slotId, booking.slotId);
    assert.equal(saved.email, 'private@example.com');
    assert.equal(saved.confirmationSource, 'standard');
    fallback = false;
  });
});
