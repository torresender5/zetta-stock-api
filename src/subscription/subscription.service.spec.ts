import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from 'src/payment/payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const prisma = {
    plan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    paymentOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const paymentService = {
    availability: jest.fn(),
    createCheckout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    paymentService.availability.mockReturnValue({ stripe: true, pabilo: true });
    paymentService.createCheckout.mockResolvedValue({
      checkoutUrl: 'https://checkout.example/pay',
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentService, useValue: paymentService },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  const freePlan = {
    id: 1,
    key: 'free',
    name: 'Gratis',
    active: true,
    priceMonthly: 0,
    priceYearly: 0,
    trialDays: 30,
    maxUsers: 1,
    allowedViews: [],
    features: [],
  };

  const basicoPlan = {
    id: 2,
    key: 'basico',
    name: 'Básico',
    active: true,
    priceMonthly: 35000,
    priceYearly: 300000,
    trialDays: null,
    maxUsers: 3,
    allowedViews: [],
    features: [],
  };

  describe('purchase', () => {
    it('reinicia el trial cuando el plan elegido es gratuito', async () => {
      prisma.plan.findUnique.mockResolvedValue(freePlan);
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.subscription.upsert.mockResolvedValue({
        ...freePlan,
        status: 'active',
      });

      const result = await service.purchase(10, {
        planId: 1,
        period: 'monthly',
      });

      expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
      expect(prisma.subscription.upsert).toHaveBeenCalled();
      expect(result.order).toBeNull();
    });

    it('crea una orden pendiente cuando el plan es de pago', async () => {
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.paymentOrder.create.mockResolvedValue({
        id: 99,
        planKey: 'basico',
        period: 'monthly',
        amount: 35000,
        status: 'pending',
      });

      const result = await service.purchase(10, {
        planId: 2,
        period: 'monthly',
      });

      expect(prisma.paymentOrder.create).toHaveBeenCalled();
      expect(result.order?.status).toBe('pending');
      expect(result.order?.amount).toBe(35000);
    });

    it('inicia el checkout de Stripe cuando el proveedor es stripe', async () => {
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.paymentOrder.create.mockResolvedValue({
        id: 101,
        companyId: 10,
        planKey: 'basico',
        period: 'monthly',
        amount: 35000,
        concept: 'Suscripción Básico mensual',
        status: 'pending',
        provider: 'stripe',
        currency: 'USD',
        checkoutUrl: null,
        paidAt: null,
        createdAt: new Date(),
      });

      const result = await service.purchase(10, {
        planId: 2,
        period: 'monthly',
        provider: 'stripe',
      });

      expect(paymentService.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ id: 101 }),
        'stripe',
      );
      expect(result.order?.provider).toBe('stripe');
      expect(result.order?.checkoutUrl).toBe('https://checkout.example/pay');
    });

    it('lanza error si el proveedor no está disponible en el servidor', async () => {
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      prisma.subscription.findUnique.mockResolvedValue(null);
      paymentService.availability.mockReturnValue({
        stripe: false,
        pabilo: false,
      });

      await expect(
        service.purchase(10, {
          planId: 2,
          period: 'monthly',
          provider: 'pabilo',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
    });

    it('lanza error si el checkout del proveedor falla', async () => {
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.paymentOrder.create.mockResolvedValue({
        id: 102,
        companyId: 10,
        planKey: 'basico',
        period: 'monthly',
        amount: 35000,
        concept: 'Suscripción Básico mensual',
        status: 'pending',
        provider: 'stripe',
        currency: 'USD',
        checkoutUrl: null,
        paidAt: null,
        createdAt: new Date(),
      });
      paymentService.createCheckout.mockRejectedValue(new Error('sin clave'));

      await expect(
        service.purchase(10, {
          planId: 2,
          period: 'monthly',
          provider: 'stripe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('genera solo la orden (manual) cuando no se envía proveedor', async () => {
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      prisma.subscription.findUnique.mockResolvedValue(null);
      prisma.paymentOrder.create.mockResolvedValue({
        id: 103,
        companyId: 10,
        planKey: 'basico',
        period: 'monthly',
        amount: 35000,
        concept: 'Suscripción Básico mensual',
        status: 'pending',
        provider: 'manual',
        currency: 'USD',
        checkoutUrl: null,
        paidAt: null,
        createdAt: new Date(),
      });

      const result = await service.purchase(10, {
        planId: 2,
        period: 'monthly',
      });

      expect(paymentService.createCheckout).not.toHaveBeenCalled();
      expect(result.order?.checkoutUrl).toBeNull();
    });

    it('lanza error si el plan no existe', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(
        service.purchase(10, { planId: 999, period: 'monthly' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza error si el período es inválido', async () => {
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      await expect(
        service.purchase(10, { planId: 2, period: 'semestral' as never }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmPaymentOrder', () => {
    it('activa la suscripción y marca la orden como pagada', async () => {
      prisma.paymentOrder.findUnique.mockResolvedValue({
        id: 7,
        companyId: 3,
        planKey: 'basico',
        period: 'monthly',
        amount: 35000,
        status: 'pending',
      });
      prisma.plan.findUnique.mockResolvedValue(basicoPlan);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.confirmPaymentOrder(7);

      expect(result.ok).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rechaza confirmar una orden ya procesada', async () => {
      prisma.paymentOrder.findUnique.mockResolvedValue({
        id: 8,
        status: 'paid',
      });
      await expect(service.confirmPaymentOrder(8)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createPlan / removePlan', () => {
    it('impide eliminar el plan gratuito', async () => {
      prisma.plan.findUnique.mockResolvedValue(freePlan);
      await expect(service.removePlan(1)).rejects.toThrow(BadRequestException);
    });
  });
});
