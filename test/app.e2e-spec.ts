import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /plans devuelve el catálogo de planes', () => {
    return request(app.getHttpServer())
      .get('/plans')
      .expect(200)
      .expect((res) => {
        const body: unknown = res.body;
        expect(Array.isArray(body)).toBe(true);
        expect((body as unknown[]).length).toBeGreaterThan(0);
      });
  });

  it('el cron de suscripciones está registrado en el scheduler', () => {
    const schedulerRegistry = app.get(SchedulerRegistry);
    const jobs = schedulerRegistry.getCronJobs();
    expect(jobs.size).toBeGreaterThan(0);
    expect(jobs.has('handleExpirations')).toBe(true);
  });
});
