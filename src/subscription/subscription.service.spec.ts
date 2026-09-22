import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
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
