import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentService } from './payment.service';

const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockStripe),
}));

interface PaymentPrismaMock {
  paymentOrder: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  plan: { findUnique: jest.Mock };
  subscription: { upsert: jest.Mock };
  $transaction: jest.Mock;
}

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PaymentPrismaMock;

  const originalEnv = { ...process.env };

  const pendingOrder = {
    id: 55,
    companyId: 7,
    planKey: 'basico',
    period: 'monthly',
    amount: 35000,
    concept: 'Suscripción Básico mensual',
    status: 'pending',
    provider: 'stripe',
    currency: 'USD',
    checkoutUrl: null,
    providerRef: null,
    expiresAt: null,
    paidAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PABILO_API_KEY;
    delete process.env.PABILO_WEBHOOK_SECRET;
    delete process.env.PABILO_USER_BANK_ID;

    prisma = {
      paymentOrder: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      plan: { findUnique: jest.fn() },
      subscription: { upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  describe('availability', () => {
    it('reporta false cuando no hay credenciales', () => {
      expect(service.availability()).toEqual({
        stripe: false,
        pabilo: false,
      });
    });

    it('reporta true con las credenciales configuradas', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_1';
      process.env.PABILO_API_KEY = 'pb_test_1';
      process.env.PABILO_USER_BANK_ID = 'bank_1';

      expect(service.availability()).toEqual({
        stripe: true,
        pabilo: true,
      });
    });
  });

  describe('createCheckout · stripe', () => {
    it('lanza error si Stripe no está configurado', async () => {
      await expect(
        service.createCheckout(pendingOrder, 'stripe'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('crea la sesión y guarda providerRef/checkoutUrl en la orden', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_1';
      process.env.APP_BASE_URL = 'https://front.example';
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/pay/cs_test_1',
        expires_at: 1760000000,
      });

      const result = await service.createCheckout(pendingOrder, 'stripe');

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          line_items: [
            {
              price_data: expect.objectContaining({
                currency: 'usd',
                unit_amount: 35000 * 100,
              }),
              quantity: 1,
            },
          ],
          success_url:
            'https://front.example/suscripcion?payment=success&orderId=55',
          cancel_url: 'https://front.example/suscripcion?payment=cancelled',
          metadata: { orderId: '55' },
        }),
      );
      expect(prisma.paymentOrder.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: expect.objectContaining({
          provider: 'stripe',
          currency: 'USD',
          checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_1',
          providerRef: 'cs_test_1',
        }),
      });
      expect(result.checkoutUrl).toBe(
        'https://checkout.stripe.com/pay/cs_test_1',
      );
    });
  });

  describe('createCheckout · pabilo', () => {
    it('lanza error si Pabilo no está configurado', async () => {
      await expect(
        service.createCheckout(pendingOrder, 'pabilo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el link de pago y guarda providerRef/checkoutUrl', async () => {
      process.env.PABILO_API_KEY = 'pb_test_1';
      process.env.PABILO_USER_BANK_ID = 'bank_1';
      process.env.PUBLIC_API_URL = 'https://api.example';
      process.env.APP_BASE_URL = 'https://front.example';

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            paymentlink: {
              id: 'link_1',
              url: 'https://pabilo.app/pay/link_1',
            },
          }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await service.createCheckout(pendingOrder, 'pabilo');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.pabilo.app/v1/paymentlink',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer pb_test_1',
          }),
        }),
      );
      const init = (fetchMock.mock.calls[0] as unknown[])[1] as {
        body: string;
      };
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body).toMatchObject({
        user_bank_id: 'bank_1',
        amount: 35000,
        currency: 'USD',
        webhook_url: 'https://api.example/webhooks/payments/pabilo',
        redirect_url:
          'https://front.example/suscripcion?payment=success&orderId=55',
      });
      expect(prisma.paymentOrder.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: expect.objectContaining({
          provider: 'pabilo',
          checkoutUrl: 'https://pabilo.app/pay/link_1',
          providerRef: 'link_1',
        }),
      });
      expect(result.checkoutUrl).toBe('https://pabilo.app/pay/link_1');
    });

    it('lanza error si Pabilo responde con estado de error', async () => {
      process.env.PABILO_API_KEY = 'pb_test_1';
      process.env.PABILO_USER_BANK_ID = 'bank_1';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('bad request'),
      }) as unknown as typeof fetch;

      await expect(
        service.createCheckout(pendingOrder, 'pabilo'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('handlePabiloWebhook', () => {
    const secret = 'pabilo_secret_test';

    const sign = (payload: Buffer, timestamp: string): string =>
      'sha256=' +
      createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(payload)
        .digest('hex');

    beforeEach(() => {
      process.env.PABILO_WEBHOOK_SECRET = secret;
    });

    it('rechaza firmas ausentes o inválidas', async () => {
      const payload = Buffer.from('{"status":"paid"}');
      await expect(service.handlePabiloWebhook(payload, {})).rejects.toThrow(
        UnauthorizedException,
      );

      await expect(
        service.handlePabiloWebhook(payload, {
          'x-pabilo-timestamp': String(Math.floor(Date.now() / 1000)),
          'x-pabilo-signature': `sha256=${'a'.repeat(64)}`,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza firmas con timestamp fuera de la ventana', async () => {
      const payload = Buffer.from('{"status":"paid"}');
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 3600);

      await expect(
        service.handlePabiloWebhook(payload, {
          'x-pabilo-timestamp': oldTimestamp,
          'x-pabilo-signature': sign(payload, oldTimestamp),
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('liquida la orden pendiente cuando el pago está paid', async () => {
      const event = {
        payment_link_id: 'link_1',
        status: 'paid',
        user_bank_payment: { bank_reference_id: '0025513902095' },
      };
      const payload = Buffer.from(JSON.stringify(event));
      const timestamp = String(Math.floor(Date.now() / 1000));

      prisma.paymentOrder.findFirst.mockResolvedValue({
        ...pendingOrder,
        provider: 'pabilo',
        providerRef: 'link_1',
      });
      prisma.paymentOrder.findUnique.mockResolvedValue({
        ...pendingOrder,
        provider: 'pabilo',
        providerRef: 'link_1',
      });
      prisma.plan.findUnique.mockResolvedValue({ id: 2, key: 'basico' });

      const result = await service.handlePabiloWebhook(payload, {
        'x-pabilo-timestamp': timestamp,
        'x-pabilo-signature': sign(payload, timestamp),
      });

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 55 },
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });

    it('ignora el reintento si la orden ya fue pagada (idempotencia)', async () => {
      const event = { payment_link_id: 'link_1', status: 'paid' };
      const payload = Buffer.from(JSON.stringify(event));
      const timestamp = String(Math.floor(Date.now() / 1000));

      prisma.paymentOrder.findFirst.mockResolvedValue({
        ...pendingOrder,
        status: 'paid',
        provider: 'pabilo',
        providerRef: 'link_1',
      });
      prisma.paymentOrder.findUnique.mockResolvedValue({
        ...pendingOrder,
        status: 'paid',
        provider: 'pabilo',
        providerRef: 'link_1',
      });

      const result = await service.handlePabiloWebhook(payload, {
        'x-pabilo-timestamp': timestamp,
        'x-pabilo-signature': sign(payload, timestamp),
      });

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('marca la orden como rechazada cuando el pago falla', async () => {
      const event = { payment_link_id: 'link_1', status: 'failed' };
      const payload = Buffer.from(JSON.stringify(event));
      const timestamp = String(Math.floor(Date.now() / 1000));

      prisma.paymentOrder.findFirst.mockResolvedValue({
        ...pendingOrder,
        provider: 'pabilo',
        providerRef: 'link_1',
      });

      await service.handlePabiloWebhook(payload, {
        'x-pabilo-timestamp': timestamp,
        'x-pabilo-signature': sign(payload, timestamp),
      });

      expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 55, status: 'pending' },
        data: { status: 'rejected' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('acepta el evento sin órdenes asociadas (link desconocido)', async () => {
      const event = { payment_link_id: 'otro_link', status: 'paid' };
      const payload = Buffer.from(JSON.stringify(event));
      const timestamp = String(Math.floor(Date.now() / 1000));

      prisma.paymentOrder.findFirst.mockResolvedValue(null);

      const result = await service.handlePabiloWebhook(payload, {
        'x-pabilo-timestamp': timestamp,
        'x-pabilo-signature': sign(payload, timestamp),
      });

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('handleStripeWebhook', () => {
    it('lanza error si la firma es inválida', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_1';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_1';
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'sig=invalida'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('liquida la orden del metadata al completar el pago', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_1';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_1';
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            payment_status: 'paid',
            metadata: { orderId: '55' },
          },
        },
      });
      prisma.paymentOrder.findUnique.mockResolvedValue(pendingOrder);
      prisma.plan.findUnique.mockResolvedValue({ id: 2, key: 'basico' });

      const result = await service.handleStripeWebhook(
        Buffer.from('{}'),
        'stripe-sig',
      );

      expect(result).toEqual({ received: true });
      expect(prisma.paymentOrder.findUnique).toHaveBeenCalledWith({
        where: { id: 55 },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('no liquida si la sesión no está pagada', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_1';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_1';
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: { id: 'cs_2', payment_status: 'unpaid', metadata: {} },
        },
      });

      const result = await service.handleStripeWebhook(
        Buffer.from('{}'),
        'stripe-sig',
      );

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ignora otros eventos de Stripe sin error', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_1';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_1';
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const result = await service.handleStripeWebhook(
        Buffer.from('{}'),
        'stripe-sig',
      );

      expect(result).toEqual({ received: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
