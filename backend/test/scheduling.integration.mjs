import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { Slot } from '../dist/slots/slot.entity.js';
import { Booking } from '../dist/bookings/booking.entity.js';

// Uses DATABASE_URL. Creates uniquely identified records and deletes only its own data.
void describe('Scheduling API with real PostgreSQL', { timeout: 60000 }, () => {
  let app;
  let database;
  const slotIds = [];
  const attendee = { name: 'Integration Test', email: 'scheduler-test@example.com' };

  async function openApp() {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    configureApp(app);
    await app.init();
    database = app.get(DataSource);
  }

  async function createSlot() {
    const input = {
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 30,
    };
    const response = await request(app.getHttpServer()).post('/api/slots').send(input).expect(201);
    slotIds.push(response.body.id);
    assert.equal(response.body.durationMinutes, 30);
    assert.equal(response.body.startsAt, input.startsAt);
    return response.body;
  }

  before(openApp);
  after(async () => {
    try {
      if (database?.isInitialized && slotIds.length) {
        await database.getRepository(Booking).createQueryBuilder().delete()
          .where('slot_id IN (:...ids)', { ids: slotIds }).execute();
        await database.getRepository(Slot).delete(slotIds);
      }
    } finally {
      if (app) await app.close();
    }
  });

  void it('validates slot dates, explicit timezones, duration, and unexpected fields', async () => {
    const valid = { startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30 };
    for (const input of [
      { ...valid, startsAt: 'not-a-date' },
      { ...valid, startsAt: '2099-01-01T12:00:00' },
      { ...valid, startsAt: '2000-01-01T12:00:00Z' },
      { ...valid, durationMinutes: 0 },
      { ...valid, durationMinutes: 1.5 },
      { ...valid, durationMinutes: '30' },
      { ...valid, durationMinutes: 1441 },
      { ...valid, hostId: 'unexpected' },
    ]) {
      await request(app.getHttpServer()).post('/api/slots').send(input).expect(400);
    }
  });

  void it('persists a slot across an app restart and lists it without attendee data', async () => {
    const slot = await createSlot();
    await app.close();
    await openApp();
    const response = await request(app.getHttpServer()).get('/api/slots').expect(200);
    const persisted = response.body.find(item => item.id === slot.id);
    assert.ok(persisted);
    assert.equal(persisted.startsAt, slot.startsAt);
    assert.equal('email' in persisted, false);
    assert.equal('name' in persisted, false);
  });

  void it('validates booking details and handles unknown or invalid slot IDs', async () => {
    const slot = await createSlot();
    for (const input of [
      { name: ' ', email: attendee.email },
      { name: attendee.name, email: 'invalid' },
      { ...attendee, extra: true },
      {},
    ]) {
      await request(app.getHttpServer()).post(`/api/slots/${slot.id}/bookings`).send(input).expect(400);
    }
    await request(app.getHttpServer()).post('/api/slots/not-a-uuid/bookings').send(attendee).expect(400);
    await request(app.getHttpServer()).post(`/api/slots/${randomUUID()}/bookings`).send(attendee).expect(404);
  });

  void it('accepts exactly one of eight concurrent bookings and hides the booked slot', async () => {
    const slot = await createSlot();
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      request(app.getHttpServer()).post(`/api/slots/${slot.id}/bookings`).send(attendee),
    ));
    assert.equal(responses.filter(response => response.status === 201).length, 1);
    assert.equal(responses.filter(response => response.status === 409).length, 7);
    const receipt = responses.find(response => response.status === 201).body;
    assert.equal(receipt.slotId, slot.id);
    assert.equal('email' in receipt, false);
    assert.equal(await database.getRepository(Booking).countBy({ slotId: slot.id }), 1);
    const available = await request(app.getHttpServer()).get('/api/slots').expect(200);
    assert.equal(available.body.some(item => item.id === slot.id), false);
    // A write bypassing the service must still be rejected by the database.
    await assert.rejects(database.getRepository(Booking).insert({ slotId: slot.id, ...attendee }),
      error => error.driverError?.code === '23505' &&
        error.driverError?.constraint === 'bookings_slot_id_unique');
    await app.close();
    await openApp();
    assert.equal(await database.getRepository(Booking).countBy({ slotId: slot.id }), 1);
    const afterRestart = await request(app.getHttpServer()).get('/api/slots').expect(200);
    assert.equal(afterRestart.body.some(item => item.id === slot.id), false);
  });

  void it('excludes expired slots and rejects attempts to book them', async () => {
    const slot = await database.getRepository(Slot).save({
      startsAt: new Date(Date.now() - 60000), durationMinutes: 30,
    });
    slotIds.push(slot.id);
    await request(app.getHttpServer()).post(`/api/slots/${slot.id}/bookings`).send(attendee).expect(409);
    const response = await request(app.getHttpServer()).get('/api/slots').expect(200);
    assert.equal(response.body.some(item => item.id === slot.id), false);
  });
});
