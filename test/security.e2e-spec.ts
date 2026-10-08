import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Seguridad (Fase 1)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let companyId: number;
  let subId: number;
  let companyBId: number;
  const ts = Date.now();
  const emailA = `fase1-a-${ts}@test.local`;
  const emailB = `fase1-b-${ts}@test.local`;

  const decodePayload = (jwt: string): Record<string, unknown> =>
    JSON.parse(
      Buffer.from(jwt.split('.')[1], 'base64').toString('utf-8'),
    ) as Record<string, unknown>;

  const register = (email: string, name: string) =>
    request(app.getHttpServer()).post('/auth/register').send({
      user: name,
      email,
      password: 'test1234',
      accountType: 'PERSONA',
      acceptTerms: true,
      acceptPrivacy: true,
      over18: true,
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Mismo pipe global que main.ts (whitelist + forbidNonWhitelisted).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await register(emailA, 'Fase1A').expect(200);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailA, password: 'test1234' })
      .expect(200);
    token = (login.body as { access_token: string }).access_token;

    await register(emailB, 'Fase1B').expect(200);

    const userA = await prisma.user.findUnique({ where: { email: emailA } });
    companyId = userA!.companyId!;
    const subA = await prisma.subscription.findUnique({
      where: { companyId },
    });
    subId = subA!.id;
    const userB = await prisma.user.findUnique({ where: { email: emailB } });
    companyBId = userB!.companyId!;
  }, 60000);

  afterAll(async () => {
    for (const [company, email] of [
      [companyBId, emailB],
      [companyId, emailA],
    ] as const) {
      await prisma.subscription
        .delete({ where: { companyId: company } })
        .catch(() => {});
      await prisma.user.delete({ where: { email } }).catch(() => {});
      await prisma.company.delete({ where: { id: company } }).catch(() => {});
    }
    await app.close();
  }, 60000);

  it('POST /auth/register sin consentimiento → 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        user: 'SinConsent',
        email: `fase1-sin-${ts}@test.local`,
        password: 'test1234',
        accountType: 'PERSONA',
      })
      .expect(400);
  });

  it('POST /auth/register con consentimiento incompleto → 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        user: 'ConsentParcial',
        email: `fase1-parcial-${ts}@test.local`,
        password: 'test1234',
        accountType: 'PERSONA',
        acceptTerms: true,
        acceptPrivacy: true,
        over18: false,
      })
      .expect(400);
  });

  it('POST /mail/send sin token → 401', async () => {
    await request(app.getHttpServer())
      .post('/mail/send')
      .send({
        email: 'x@y.z',
        subject: 's',
        templatePath: './x',
        context: '{}',
      })
      .expect(401);
  });

  it('POST /mail/send con token inválido → 401', async () => {
    await request(app.getHttpServer())
      .post('/mail/send')
      .set('Authorization', 'Bearer invalido')
      .send({
        email: 'x@y.z',
        subject: 's',
        templatePath: './x',
        context: '{}',
      })
      .expect(401);
  });

  it('POST /mail/send con templatePath fuera del allowlist → 400', async () => {
    await request(app.getHttpServer())
      .post('/mail/send')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'prueba@zettastock.local',
        subject: 's',
        templatePath: '../secreto',
        context: '{}',
      })
      .expect(400);
  });

  it('plan vigente: GET /products → 200', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('plan free sin "reports": GET /reports/sales → 403 PLAN_VIEW_DENIED', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/sales')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('PLAN_VIEW_DENIED');
  });

  it('plan free con "accountsReceivable": GET /reports/accounts-receivable → 200', async () => {
    await request(app.getHttpServer())
      .get('/reports/accounts-receivable')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('plan free sin "users": GET /users/email/:email → 403 PLAN_VIEW_DENIED', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/email/${emailA}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('PLAN_VIEW_DENIED');
  });

  it('con plan pro: /users/email/:email no expone la contraseña', async () => {
    const pro = await prisma.plan.findUnique({ where: { key: 'pro' } });
    await prisma.subscription.update({
      where: { id: subId },
      data: { planId: pro!.id },
    });
    const res = await request(app.getHttpServer())
      .get(`/users/email/${emailA}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body as { email?: string };
    expect(body.email).toBe(emailA);
    expect(body).not.toHaveProperty('password');
  });

  it('con plan pro: /users/email/:email no cruza de empresa → null', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/email/${emailB}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // No devuelve datos de usuarios de otra empresa (null → cuerpo vacío).
    const body = res.body as Record<string, unknown>;
    expect(Object.keys(body).length).toBe(0);
    expect(JSON.stringify(body)).not.toContain(emailB);
  });

  it('subcuenta sin consentimiento: JWT con flag y POST /auth/accept-legal', async () => {
    const subEmail = `fase1-sub-${ts}@test.local`;
    await request(app.getHttpServer())
      .post('/users/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user: 'Subcuenta Fase1',
        email: subEmail,
        password: 'test1234',
        role: 'vendedor',
      })
      .expect(201);

    const subLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: subEmail, password: 'test1234' })
      .expect(200);
    const subToken = (subLogin.body as { access_token: string }).access_token;
    expect(decodePayload(subToken).requiresLegalAcceptance).toBe(true);

    const accepted = await request(app.getHttpServer())
      .post('/auth/accept-legal')
      .set('Authorization', `Bearer ${subToken}`)
      .set('User-Agent', 'jest-supertest')
      .send({ acceptTerms: true, acceptPrivacy: true, over18: true })
      .expect(200);

    const newToken = (accepted.body as { access_token: string }).access_token;
    expect(decodePayload(newToken).requiresLegalAcceptance).toBe(false);

    const consent = await prisma.consentLog.findMany({
      where: { user: { email: subEmail } },
      orderBy: { type: 'asc' },
    });
    expect(consent.map((entry) => entry.type)).toEqual(['privacy', 'terms']);
    expect(consent[0].version).toBe('1.0');
    expect(consent[0].ip).toBeTruthy();
    expect(consent[0].userAgent).toBe('jest-supertest');

    await prisma.user.delete({ where: { email: subEmail } }).catch(() => {});
  }, 60000);

  it('POST /auth/accept-legal sin token → 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/accept-legal')
      .send({ acceptTerms: true, acceptPrivacy: true, over18: true })
      .expect(401);
  });

  it('suscripción vencida: /products → 403 PLAN_EXPIRED', async () => {
    await prisma.subscription.update({
      where: { id: subId },
      data: {
        trialEndsAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('PLAN_EXPIRED');
  });

  it('suscripción vencida: /auth/login y /plans siguen accesibles', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: emailA, password: 'test1234' })
      .expect(200);
    await request(app.getHttpServer()).get('/plans').expect(200);
  });
});
