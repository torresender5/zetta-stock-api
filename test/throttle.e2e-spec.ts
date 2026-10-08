import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { securityHeaders } from './../src/config/security';

describe('Seguridad (Fase 4): helmet + rate limit de auth', () => {
  let app: INestApplication<App>;
  const limit = Number(process.env.AUTH_RATE_LIMIT ?? 10);
  const login = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'sin-cuenta@test.local', password: 'cualquiera' });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Mismo middleware global que main.ts.
    app.use(securityHeaders);
    // Mismo pipe global que main.ts (whitelist + forbidNonWhitelisted).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 60000);

  it('helmet añade cabeceras de seguridad a cualquier respuesta', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(401);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('/auth/login devuelve 401 dentro del límite y 429 al superarlo', async () => {
    for (let intento = 0; intento < limit; intento++) {
      const res = await login().expect(401);
      expect(res.headers['x-ratelimit-limit']).toBe(String(limit));
    }

    await login().expect(429);
  });

  it('el resto de rutas no está limitado (skipIf)', async () => {
    for (let intento = 0; intento < limit + 5; intento++) {
      await request(app.getHttpServer()).get('/products').expect(401);
    }
  });
});
