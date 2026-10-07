import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Pasarela de pagos (Fase 5.1, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let companyId: number;
  const ts = Date.now();
  const email = `fase51-${ts}@test.local`;

  const PABILO_SECRET = 'pabilo_e2e_secret';
  const originalEnv = { ...process.env };

  const signPabilo = (payload: Buffer, timestamp: string): string =>
    'sha256=' +
    createHmac('sha256', PABILO_SECRET)
      .update(`${timestamp}.`)
      .update(payload)
      .digest('hex');

  beforeAll(async () => {
    process.env.PABILO_WEBHOOK_SECRET = PABILO_SECRET;
    process.env.STRIPE_SECRET_KEY = 'sk_test_e2e';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_e2e';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // rawBody:true adjunta el body crudo (req.rawBody) como en producción
    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        user: 'Fase51',
        email,
        password: 'test1234',
        accountType: 'PERSONA',
      })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'test1234' })
      .expect(200);
    token = (login.body as { access_token: string }).access_token;
    const user = await prisma.user.findUnique({ where: { email } });
    companyId = user!.companyId!;
  }, 60000);

  afterAll(async () => {
    await prisma.paymentOrder.deleteMany({ where: { companyId } });
    await prisma.subscription.delete({ where: { companyId } }).catch(() => {});
    await prisma.user.delete({ where: { email } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    process.env = { ...originalEnv };
    await app.close();
  }, 60000);

  it('GET /subscription/payment-methods informa los métodos activos', async () => {
    const res = await request(app.getHttpServer())
      .get('/subscription/payment-methods')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ stripe: true, pabilo: false });
  });

  it('POST /subscription/purchase con proveedor no disponible → 400 sin crear orden', async () => {
    const plan = await prisma.plan.findUnique({ where: { key: 'basico' } });
    const before = await prisma.paymentOrder.count({ where: { companyId } });

    await request(app.getHttpServer())
      .post('/subscription/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan!.id, period: 'monthly', provider: 'pabilo' })
      .expect(400);

    const after = await prisma.paymentOrder.count({ where: { companyId } });
    expect(after).toBe(before);
  });

  it('POST /subscription/purchase manual genera la orden pendiente', async () => {
    const plan = await prisma.plan.findUnique({ where: { key: 'basico' } });

    const res = await request(app.getHttpServer())
      .post('/subscription/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: plan!.id, period: 'monthly' })
      .expect(201);

    const body = res.body as {
      order: { status: string; provider: string; checkoutUrl: string | null };
    };
    expect(body.order.status).toBe('pending');
    expect(body.order.provider).toBe('manual');
    expect(body.order.checkoutUrl).toBeNull();
  });

  it('POST /webhooks/payments/pabilo con firma inválida → 401', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/payments/pabilo')
      .set('X-Pabilo-Timestamp', String(Math.floor(Date.now() / 1000)))
      .set('X-Pabilo-Signature', `sha256=${'a'.repeat(64)}`)
      .send({ payment_link_id: 'x', status: 'paid' })
      .expect(401);
  });

  it('POST /webhooks/payments/pabilo liquida la orden pendiente y activa la suscripción', async () => {
    const plan = await prisma.plan.findUnique({ where: { key: 'basico' } });
    const order = await prisma.paymentOrder.create({
      data: {
        companyId,
        planKey: 'basico',
        period: 'monthly',
        amount: 35000,
        concept: 'Suscripción Básico mensual',
        provider: 'pabilo',
        currency: 'USD',
        providerRef: `e2e_link_${ts}`,
      },
    });

    const payload = Buffer.from(
      JSON.stringify({
        payment_link_id: `e2e_link_${ts}`,
        status: 'paid',
        user_bank_payment: { bank_reference_id: '002999888777' },
      }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000));

    await request(app.getHttpServer())
      .post('/webhooks/payments/pabilo')
      .set('X-Pabilo-Timestamp', timestamp)
      .set('X-Pabilo-Signature', signPabilo(payload, timestamp))
      .set('Content-Type', 'application/json')
      .send(payload.toString())
      .expect(200);

    const settled = await prisma.paymentOrder.findUnique({
      where: { id: order.id },
    });
    expect(settled?.status).toBe('paid');
    expect(settled?.paidAt).not.toBeNull();

    const sub = await prisma.subscription.findUnique({ where: { companyId } });
    expect(sub?.planId).toBe(plan!.id);
    expect(sub?.status).toBe('active');
    expect(sub?.period).toBe('monthly');
  }, 30000);

  it('el mismo webhook repetido es idempotente', async () => {
    const payload = Buffer.from(
      JSON.stringify({
        payment_link_id: `e2e_link_${ts}`,
        status: 'paid',
      }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000));

    await request(app.getHttpServer())
      .post('/webhooks/payments/pabilo')
      .set('X-Pabilo-Timestamp', timestamp)
      .set('X-Pabilo-Signature', signPabilo(payload, timestamp))
      .set('Content-Type', 'application/json')
      .send(payload.toString())
      .expect(200);

    const orders = await prisma.paymentOrder.findMany({
      where: { companyId, providerRef: `e2e_link_${ts}` },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('paid');
  });

  it('POST /webhooks/payments/stripe con firma inválida → 400', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/payments/stripe')
      .set('Stripe-Signature', 't=1,v1=bad')
      .send({ type: 'checkout.session.completed' })
      .expect(400);
  });

  it('POST /webhooks/payments/stripe sin firma → 400', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/payments/stripe')
      .send({ type: 'checkout.session.completed' })
      .expect(400);
  });
});
