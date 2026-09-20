import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('CashRegisterService', () => {
  let service: CashRegisterService;
  let prisma: {
    cashRegister: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    cashMovement: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      cashRegister: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cashMovement: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashRegisterService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CashRegisterService>(CashRegisterService);
  });

  describe('open', () => {
    it('creates the register and an opening movement', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);
      prisma.cashRegister.create.mockResolvedValue({
        id: 1,
        baseAmount: 50000,
      });
      prisma.cashMovement.create.mockResolvedValue({ id: 10 });

      const result = await service.open(7, { baseAmount: 50000 }, 3);

      expect(prisma.cashRegister.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ baseAmount: 50000 }),
        }),
      );
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'opening',
            paymentMethod: 'cash',
            amount: 50000,
          }),
        }),
      );
      expect(result.baseAmount).toBe(50000);
    });

    it('rejects when there is already an open register for the user', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 9,
        status: 'open',
      });

      await expect(service.open(7, { baseAmount: 0 }, 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.cashRegister.create).not.toHaveBeenCalled();
    });
  });

  describe('addMovement', () => {
    it('stores negative amounts for expense and positive for deposit', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 1,
        status: 'open',
      });

      await service.addMovement(
        1,
        { type: 'expense', paymentMethod: 'cash', amount: 10000 },
        3,
      );
      await service.addMovement(
        1,
        { type: 'deposit', paymentMethod: 'cash', amount: 20000 },
        3,
      );

      const calls = prisma.cashMovement.create.mock.calls;
      expect(calls[0][0].data.amount).toBe(-10000);
      expect(calls[1][0].data.amount).toBe(20000);
    });

    it('rejects movements on a closed register', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 1,
        status: 'closed',
      });

      await expect(
        service.addMovement(
          1,
          { type: 'expense', paymentMethod: 'cash', amount: 1000 },
          3,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    const openRegister = {
      id: 1,
      status: 'open',
      baseAmount: 50000,
      movements: [
        { type: 'opening', amount: 50000 },
        { type: 'sale', amount: 150000 },
        { type: 'expense', amount: -10000 },
      ],
    };

    it('computes expected, counted and difference', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(openRegister);
      prisma.cashRegister.update.mockResolvedValue({ id: 1, status: 'closed' });

      await service.close(
        1,
        { cash: 250000, card: 0, transfer: 0, credit: 0 },
        3,
      );

      const updateData = prisma.cashRegister.update.mock.calls[0][0].data;
      expect(updateData.expectedTotal).toBe(190000);
      expect(updateData.countedTotal).toBe(250000);
      expect(updateData.difference).toBe(60000);
      expect(updateData.status).toBe('closed');
    });

    it('rejects closing an already closed register', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 1,
        status: 'closed',
      });

      await expect(service.close(1, { cash: 0 }, 3)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws not found when scoped by company', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(service.close(999, { cash: 0 }, 3)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSummary', () => {
    it('aggregates totals by payment method', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({
        id: 1,
        baseAmount: 50000,
        movements: [
          { type: 'sale', paymentMethod: 'cash', amount: 120000 },
          { type: 'sale', paymentMethod: 'card', amount: 80000 },
          { type: 'expense', paymentMethod: 'cash', amount: -15000 },
        ],
      });

      const summary = await service.getSummary(1, 3);

      expect(summary.salesTotal).toBe(200000);
      expect(summary.salesByMethod).toEqual({ cash: 120000, card: 80000 });
      expect(summary.expectedByMethod).toEqual({ cash: 155000, card: 80000 });
      expect(summary.outcomesTotal).toBe(-15000);
      expect(summary.expectedTotal).toBe(235000);
    });
  });
});
