import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DatabaseModule } from './../src/database/database.module.js';
import { SlotsModule } from './../src/slots/slots.module.js';
import { BookingsModule } from './../src/bookings/bookings.module.js';
import { configureApp } from './../src/configure-app.js';
import { configureFrontend } from './../src/frontend-hosting.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';

// This test exercises HTTP routing only. Live database verification is separate.
@Module({})
class NoDatabaseModule {}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let frontend: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(NoDatabaseModule)
      .overrideModule(SlotsModule)
      .useModule(NoDatabaseModule)
      .overrideModule(BookingsModule)
      .useModule(NoDatabaseModule)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    frontend = await mkdtemp(join(tmpdir(), 'common-time-frontend-'));
    await writeFile(join(frontend, 'index.html'), '<!doctype html><title>Common Time</title>');
    await writeFile(join(frontend, 'test.js'), 'console.log("frontend")');
    configureFrontend(app as NestExpressApplication, frontend);
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('serves the production page and assets alongside the API', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Content-Type', /html/).expect(/Common Time/);
    await request(app.getHttpServer()).get('/test.js').expect(200).expect(/frontend/);
  });

  it('does not turn missing API routes or assets into successful HTML responses', async () => {
    await request(app.getHttpServer()).get('/api/missing').expect(404).expect('Content-Type', /json/);
    await request(app.getHttpServer()).post('/api/missing').send({}).expect(404);
    await request(app.getHttpServer()).get('/missing.js').expect(404);
  });

  afterEach(async () => {
    await app.close();
    // Only remove the exact temporary directory created by this test.
    if (frontend.startsWith(join(tmpdir(), 'common-time-frontend-'))) await rm(frontend, { recursive: true });
  });
});
