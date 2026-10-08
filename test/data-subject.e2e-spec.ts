import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// La BD compartida tiene latencia alta (registro con transacción de empresa).
jest.setTimeout(30000);

describe('Fase 3 legal — Derechos ARCO', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let token: string;
  let userId: number;
  let companyId: number;
  let subscriptionId: number;
  let anonUserId = 0;
  let anonCompanyId = 0;

  const ts = Date.now();
  const email = `arco-${ts}@test.local`;
  const emailAnon = `arco-anon-${ts}@test.local`;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const register = (mail: string, name: string) =>
    request(app.getHttpServer()).post('/auth/register').send({
      user: name,
      email: mail,
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

    await register(email, 'ArcoTitular').expect(200);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'test1234' })
      .expect(200);
    token = (login.body as { access_token: string }).access_token;

    const user = await prisma.user.findUnique({ where: { email } });
    userId = user!.id;
    companyId = user!.companyId!;
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
    });
    subscriptionId = subscription!.id;
  }, 60000);

  afterAll(async () => {
    try {
      const ids = [userId, anonUserId].filter((id) => Number.isInteger(id));
      await prisma.dataSubjectRequest
        .deleteMany({ where: { userId: { in: ids } } })
        .catch(() => {});
      await prisma.consentLog
        .deleteMany({ where: { userId: { in: ids } } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: anonUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      await prisma.subscription
        .delete({ where: { companyId } })
        .catch(() => {});
      if (anonCompanyId) {
        await prisma.subscription
          .delete({ where: { companyId: anonCompanyId } })
          .catch(() => {});
        await prisma.company
          .delete({ where: { id: anonCompanyId } })
          .catch(() => {});
      }
      await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      await app.close();
    }
  }, 60000);

  describe('GET /users/me/export', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer()).get('/users/me/export').expect(401);
    });

    it('devuelve perfil, empresa y consentimientos sin la contraseña', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me/export')
        .set(auth(token))
        .expect(200);

      const body = res.body as {
        generadoEn: string;
        perfil: { id: number; email: string; aceptoTerminos: boolean };
        empresa: { id: number } | null;
        consentimientos: { tipo: string; version: string; ip: string }[];
        solicitudes: unknown[];
      };
      expect(body.perfil.id).toBe(userId);
      expect(body.perfil.email).toBe(email);
      expect(body.perfil.aceptoTerminos).toBe(true);
      expect(body.empresa?.id).toBe(companyId);
      expect(body.consentimientos.map((c) => c.tipo).sort()).toEqual([
        'privacy',
        'terms',
      ]);
      expect(body.consentimientos[0].ip).toBeTruthy();
      expect(res.text).not.toContain('password');
      expect(res.text).not.toContain('test1234');
    });
  });

  describe('POST /data-subject-request', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer())
        .post('/data-subject-request')
        .send({ type: 'acceso', motivo: 'Solicito copia de mis datos' })
        .expect(401);
    });

    it('tipo desconocido o motivo corto → 400', async () => {
      await request(app.getHttpServer())
        .post('/data-subject-request')
        .set(auth(token))
        .send({ type: 'borrado', motivo: 'x' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/data-subject-request')
        .set(auth(token))
        .send({ type: 'acceso', motivo: 'corto' })
        .expect(400);
    });

    it('acceso: se completa de inmediato apuntando al export', async () => {
      const res = await request(app.getHttpServer())
        .post('/data-subject-request')
        .set(auth(token))
        .set('User-Agent', 'jest-supertest')
        .send({ type: 'acceso', motivo: 'Quiero una copia de mis datos' })
        .expect(200);

      const body = res.body as { status: string; detail: string };
      expect(body.status).toBe('completada');
      expect(body.detail).toContain('/users/me/export');
    });

    it('rectificación: queda pendiente con SLA y se registra con IP/agente', async () => {
      const res = await request(app.getHttpServer())
        .post('/data-subject-request')
        .set(auth(token))
        .set('User-Agent', 'jest-supertest')
        .send({ type: 'Rectificación', motivo: 'Mi nombre está mal escrito' })
        .expect(200);

      const body = res.body as {
        id: number;
        type: string;
        status: string;
        dueAt: string;
        resolvedAt: string | null;
        ip: string;
        userAgent: string;
      };
      expect(body.type).toBe('rectificacion');
      expect(body.status).toBe('pendiente');
      expect(body.resolvedAt).toBeNull();
      // 15 días hábiles: entre 19 y 23 días naturales.
      const days = (new Date(body.dueAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(18);
      expect(days).toBeLessThan(24);
      expect(body.ip).toBeTruthy();
      expect(body.userAgent).toBe('jest-supertest');

      const stored = await prisma.dataSubjectRequest.findUnique({
        where: { id: body.id },
      });
      expect(stored?.userId).toBe(userId);
      expect(stored?.motivo).toBe('Mi nombre está mal escrito');
    });

    it('GET /data-subject-request lista las solicitudes del titular', async () => {
      const res = await request(app.getHttpServer())
        .get('/data-subject-request')
        .set(auth(token))
        .expect(200);

      const rows = res.body as { userId: number; type: string }[];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.every((row) => row.userId === userId)).toBe(true);
      expect(rows.map((row) => row.type)).toContain('rectificacion');
    });

    it('acento o mayúsculas en el tipo se normalizan', async () => {
      const res = await request(app.getHttpServer())
        .post('/data-subject-request')
        .set(auth(token))
        .send({ type: 'REVOCACIÓN', motivo: 'No quiero más correos' })
        .expect(200);
      expect((res.body as { type: string }).type).toBe('revocacion');
    });
  });

  describe('supresión (anonimización, no hard delete)', () => {
    it('baja y anonimiza la cuenta, y impide volver a entrar', async () => {
      await register(emailAnon, 'ArcoBaja').expect(200);
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailAnon, password: 'test1234' })
        .expect(200);
      const anonToken = (login.body as { access_token: string }).access_token;
      const anonUser = await prisma.user.findUnique({
        where: { email: emailAnon },
      });
      anonUserId = anonUser!.id;

      const res = await request(app.getHttpServer())
        .post('/data-subject-request')
        .set(auth(anonToken))
        .send({ type: 'supresion', motivo: 'Dejo de usar ZettaStock' })
        .expect(200);
      expect((res.body as { status: string }).status).toBe('completada');

      const stored = await prisma.user.findUnique({
        where: { id: anonUserId },
      });
      anonCompanyId = stored!.companyId!;
      expect(stored?.active).toBe(false);
      expect(stored?.email).toBe(`anonimo+${anonUserId}@zettastock.invalid`);
      expect(stored?.user).toBe('Usuario dado de baja');

      // La empresa (datos del tenant) y los consentimientos se conservan.
      const company = await prisma.company.findUnique({
        where: { id: stored!.companyId! },
      });
      expect(company).not.toBeNull();
      const consents = await prisma.consentLog.count({
        where: { userId: anonUserId },
      });
      expect(consents).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: stored!.email, password: 'test1234' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailAnon, password: 'test1234' })
        .expect(401);
    }, 60000);
  });

  describe('suscripción vencida', () => {
    it('los derechos ARCO siguen disponibles con el plan vencido', async () => {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      const past = new Date(Date.now() - 86400000);
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { trialEndsAt: past, expiresAt: past },
      });

      try {
        await request(app.getHttpServer())
          .get('/users/me/export')
          .set(auth(token))
          .expect(200);
        const res = await request(app.getHttpServer())
          .post('/data-subject-request')
          .set(auth(token))
          .send({ type: 'acceso', motivo: 'Copia con plan vencido' })
          .expect(200);
        expect((res.body as { status: string }).status).toBe('completada');
        // Módulo de usuarios (fuera de /users/me) sí lo bloquea el plan.
        await request(app.getHttpServer())
          .get('/users')
          .set(auth(token))
          .expect(403);
      } finally {
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            trialEndsAt: subscription?.trialEndsAt,
            expiresAt: subscription?.expiresAt,
          },
        });
      }
    });
  });
});
