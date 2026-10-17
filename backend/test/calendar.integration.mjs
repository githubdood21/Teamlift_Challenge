import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { databaseOptions } from '../dist/database/database-options.js';
import { GoogleCalendarClient } from '../dist/calendar/google-calendar.client.js';
import { CalendarConnection, CalendarOAuthAttempt } from '../dist/calendar/calendar.entity.js';
import { decrypt } from '../dist/calendar/calendar-security.js';
import { Booking } from '../dist/bookings/booking.entity.js';

// Real PostgreSQL, isolated schema, simulated Google. Never reads a real calendar.
void describe('Protected Calendar API and scheduling', { timeout: 60000 }, () => {
  const schema = 'calendar_test_' + randomBytes(8).toString('hex');
  const key = randomBytes(32).toString('hex');
  const originalEnv = {};
  let admin, database, app;
  let periods = [], outage = false, exchanges = 0;
  const google = {
    authorization: state => ({ verifier: 'private-code-verifier', url: 'https://accounts.google.com/o/oauth2/v2/auth?state=' + state }),
    exchange: async (code, verifier) => {
      assert.equal(code, 'test-code'); assert.equal(verifier, 'private-code-verifier');
      exchanges++; return 'test-refresh-token';
    },
    busy: async () => { if (outage) throw new Error('Simulated outage'); return periods; },
    revoke: async () => {},
  };
  function http() { return request(app.getHttpServer()); }
  async function begin() {
    const response = await http().post('/api/calendar/connect').set('Authorization', 'Bearer ' + key).expect(201);
    const state = new URL(response.body.url).searchParams.get('state');
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
    return { state, cookie };
  }
  async function slot() {
    const response = await http().post('/api/slots').send({ startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 30 }).expect(201);
    return response.body;
  }
  const attendee = { name: 'Calendar test', email: 'calendar-test@example.com' };

  before(async () => {
    const values = {
      HOST_ADMIN_KEY: key,
      CALENDAR_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/calendar/callback', APP_ORIGIN: 'http://localhost:5173',
    };
    for (const [name, value] of Object.entries(values)) { originalEnv[name] = process.env[name]; process.env[name] = value; }
    admin = new DataSource(databaseOptions());
    await admin.initialize();
    await admin.query('CREATE SCHEMA ' + schema);
    database = new DataSource({ ...databaseOptions(), schema, extra: { options: '-c search_path=' + schema } });
    await database.initialize();
    await database.runMigrations();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource).useValue(database)
      .overrideProvider(GoogleCalendarClient).useValue(google).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  after(async () => {
    if (app) await app.close();
    else if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      // The schema name is generated above, never supplied externally.
      await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
      await admin.destroy();
    }
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });

  void it('requires the host key for every management endpoint', async () => {
    await http().get('/api/calendar/status').expect(401);
    await http().get('/api/calendar/status').set('Authorization', 'Bearer wrong').expect(401);
    await http().post('/api/calendar/connect').expect(401);
    await http().delete('/api/calendar/connection').expect(401);
    const status = await http().get('/api/calendar/status').set('Authorization', 'Bearer ' + key).expect(200);
    assert.equal(status.body.connected, false);
    assert.equal(status.body.configured, true);
    assert.equal('refreshTokenCipher' in status.body, false);
  });

  void it('binds authorization to the browser, consumes state once, and encrypts stored tokens', async () => {
    const { state, cookie } = await begin();
    const path = '/api/calendar/callback?state=' + state + '&code=test-code';
    const missingCookie = await http().get(path).expect(303);
    assert.match(missingCookie.headers.location, /calendar=failed/);
    assert.equal(exchanges, 0);
    const success = await http().get(path).set('Cookie', cookie).expect(303);
    assert.match(success.headers.location, /calendar=connected/);
    assert.equal(exchanges, 1);
    const saved = await database.getRepository(CalendarConnection).findOneByOrFail({ id: 1 });
    assert.notEqual(saved.refreshTokenCipher, 'test-refresh-token');
    assert.equal(decrypt(saved.refreshTokenCipher), 'test-refresh-token');
    const replay = await http().get(path).set('Cookie', cookie).expect(303);
    assert.match(replay.headers.location, /calendar=failed/);
    assert.equal(exchanges, 1);
  });

  void it('publishes only busy times without event details, with bounded range validation', async () => {
    periods = [{ start: '2029-12-31T23:00:00Z', end: '2030-01-01T01:00:00Z', title: 'Private event' }];
    const response = await http().get('/api/calendar/busy')
      .query({ start: '2030-01-01T00:00:00Z', end: '2030-01-02T00:00:00Z' })
      .expect(200);
    assert.deepEqual(response.body.periods, [{ start: '2030-01-01T00:00:00.000Z', end: '2030-01-01T01:00:00.000Z' }]);
    assert.equal(response.body.source, 'google-calendar');
    assert.equal(response.body.connected, true);
    assert.equal(response.headers['cache-control'], 'no-store');
    for (const query of [
      { start: 'invalid', end: '2030-01-02T00:00:00Z' },
      { start: '2030-01-03T00:00:00Z', end: '2030-01-02T00:00:00Z' },
      { start: '2030-01-01T00:00:00Z', end: '2031-01-01T00:00:00Z' },
      { start: '2030-01-01', end: '2030-01-02' },
    ]) {
      await http().get('/api/calendar/busy').query(query).expect(400);
    }
    outage = true;
    await http().get('/api/calendar/busy').query({ start: '2030-01-01T00:00:00Z', end: '2030-01-02T00:00:00Z' })
      .expect(503);
    outage = false; periods = [];
  });

  void it('hides overlapping slots and rejects direct attempts to book one', async () => {
    const created = await slot();
    const start = new Date(created.startsAt).getTime();
    periods = [{ start: new Date(start - 60000).toISOString(), end: new Date(start + 60000).toISOString() }];
    const listed = await http().get('/api/slots').expect(200);
    assert.equal(listed.body.some(item => item.id === created.id), false);
    await http().post('/api/slots/' + created.id + '/bookings').send(attendee).expect(409);
    assert.equal(await database.getRepository(Booking).countBy({ slotId: created.id }), 0);
    periods = [];
    const available = await http().get('/api/slots').expect(200);
    assert.equal(available.body.some(item => item.id === created.id), true);
    await http().post('/api/slots/' + created.id + '/bookings').send(attendee).expect(201);
  });

  void it('rejects publishing a calendar conflict and permits an adjacent slot', async () => {
    const start = new Date(Date.now() + 2 * 86400000);
    periods = [{ start: start.toISOString(), end: new Date(start.getTime() + 3600000).toISOString() }];
    const conflict = await http().post('/api/slots').send({ startsAt: start.toISOString(), durationMinutes: 30 }).expect(409);
    assert.match(conflict.body.message, /calendar/);
    await http().post('/api/slots').send({ startsAt: new Date(start.getTime() + 3600000).toISOString(), durationMinutes: 30 }).expect(201);
    outage = true;
    await http().post('/api/slots').send({ startsAt: start.toISOString(), durationMinutes: 30 }).expect(503);
    outage = false;
    periods = [];
  });

  void it('keeps concurrent booking protection while the calendar is connected', async () => {
    const created = await slot();
    periods = [];
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      http().post('/api/slots/' + created.id + '/bookings').send(attendee),
    ));
    assert.equal(responses.filter(response => response.status === 201).length, 1);
    assert.equal(responses.filter(response => response.status === 409).length, 7);
  });

  void it('fails closed when Google cannot be checked without creating a booking', async () => {
    const created = await slot(); outage = true;
    await http().get('/api/slots').expect(503);
    await http().post('/api/slots/' + created.id + '/bookings').send(attendee).expect(503);
    assert.equal(await database.getRepository(Booking).countBy({ slotId: created.id }), 0);
    outage = false;
  });

  void it('rejects expired and denied consent without replacing the connection', async () => {
    const attempt = await begin();
    await database.getRepository(CalendarOAuthAttempt).createQueryBuilder().update()
      .set({ expiresAt: new Date(Date.now() - 1000) }).execute();
    const expired = await http().get('/api/calendar/callback?state=' + attempt.state + '&code=test-code').set('Cookie', attempt.cookie).expect(303);
    assert.match(expired.headers.location, /calendar=failed/);
    const deniedAttempt = await begin();
    const denied = await http().get('/api/calendar/callback?state=' + deniedAttempt.state + '&error=access_denied').set('Cookie', deniedAttempt.cookie).expect(303);
    assert.match(denied.headers.location, /calendar=denied/);
    assert.equal(exchanges, 1);
    assert.equal(await database.getRepository(CalendarConnection).count(), 1);
  });

  void it('disconnects and restores normal booking without Google', async () => {
    const response = await http().delete('/api/calendar/connection').set('Authorization', 'Bearer ' + key).expect(200);
    assert.equal(response.body.revoked, true);
    assert.equal(await database.getRepository(CalendarConnection).count(), 0);
    outage = true;
    await http().get('/api/slots').expect(200);
    const created = await slot();
    await http().post('/api/slots/' + created.id + '/bookings').send(attendee).expect(201);
  });
});
