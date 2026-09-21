import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ApartadoService } from './apartado.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

const activeApartado = (overrides: any = {}) => ({
  id: 1,
  apartadoNumber: 'APA-2026-0001',
  status: 'active',
  clientId: 5,
  client: {
    id: 5,
    name: 'Cliente',
    document: '123',
    address: 'Calle 1',
  },
  date: new Date('2026-09-18'),
  subtotal: 84033,
  tax: 15967,
  total: 100000,
  totalPaid: 0,
  items: [
    {
      productId: 2,
      productName: 'Producto',
      quantity: 2,
      unitPrice: 10000,
      subtotal: 20000,
    },
  ],
  notes: null,
  ...overrides,
});

describe('ApartadoService', () => {
  let service: ApartadoService;
  let prisma: any;

  const tx = (cb: any) => cb(prisma);

  const basePrisma = () => ({
    $transaction: jest.fn(tx),
    apartado: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    apartadoItem: {},
    apartadoPayment: { create: jest.fn() },
    product: { findFirst: jest.fn(), update: jest.fn() },
    client: { findFirst: jest.fn() },
    cashRegister: { findFirst: jest.fn() },
    cashMovement: { create: jest.fn() },
    sale: { count: jest.fn(), create: jest.fn() },
    invoice: { create: jest.fn() },
  });

  beforeEach(async () => {
    prisma = basePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApartadoService,
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

    service = module.get<ApartadoService>(ApartadoService);
  });

  describe('create', () => {
    it('creates the apartado, reserves stock and records the initial payment', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 5 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        salePrice: 10000,
        stock: 10,
      });
      prisma.apartado.count.mockResolvedValue(0);
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.apartado.create.mockResolvedValue(activeApartado());

      const dto = {
        clientId: 5,
        date: '2026-09-18',
        items: [{ productId: 2, quantity: 2 }],
        initialPayment: 20000,
        initialPaymentMethod: 'cash',
      };

      const result = await service.create(dto, 3, 9);

      expect(prisma.apartado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apartadoNumber: 'APA-2026-0001',
            total: 23800,
            totalPaid: 20000,
          }),
        }),
      );
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: { decrement: 2 } },
      });
      expect(prisma.apartadoPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 20000,
            cashRegisterId: 7,
          }),
        }),
      );
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'apartado',
            amount: 20000,
            apartadoId: 1,
            cashRegisterId: 7,
          }),
        }),
      );
      expect(result.apartadoNumber).toBe('APA-2026-0001');
    });

    it('rejects when there is no open register and there is an initial payment', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 5 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        salePrice: 10000,
        stock: 10,
      });
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            clientId: 5,
            date: '2026-09-18',
            items: [{ productId: 2, quantity: 1 }],
            initialPayment: 5000,
          },
          3,
          9,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.apartado.create).not.toHaveBeenCalled();
    });

    it('rejects when stock is insufficient', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 5 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        salePrice: 10000,
        stock: 1,
      });

      await expect(
        service.create(
          {
            clientId: 5,
            date: '2026-09-18',
            items: [{ productId: 2, quantity: 2 }],
          },
          3,
          9,
        ),
      ).rejects.toThrow('Stock insuficiente');
    });

    it('rejects when the initial payment exceeds the total', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 5 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        salePrice: 10000,
        stock: 10,
      });

      await expect(
        service.create(
          {
            clientId: 5,
            date: '2026-09-18',
            items: [{ productId: 2, quantity: 1 }],
            initialPayment: 500000,
          },
          3,
          9,
        ),
      ).rejects.toThrow('no puede superar');
    });
  });

  describe('addPayment', () => {
    it('records a partial payment as an apartado movement', async () => {
      prisma.apartado.findFirst.mockResolvedValue(activeApartado());
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.apartadoPayment.create.mockResolvedValue({ id: 1 });
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });
      prisma.apartado.update.mockResolvedValue(activeApartado());

      const result = await service.addPayment(
        1,
        { amount: 20000, paymentMethod: 'cash' },
        3,
        9,
      );

      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'apartado',
            amount: 20000,
            apartadoId: 1,
          }),
        }),
      );
      expect(result.status).toBe('active');
      expect(result.totalPaid).toBe(20000);
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    it('completes the apartado (sale + invoice + sale movement) when fully paid', async () => {
      prisma.apartado.findFirst.mockResolvedValue(
        activeApartado({ totalPaid: 80000 }),
      );
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.apartadoPayment.create.mockResolvedValue({ id: 1 });
      prisma.sale.count.mockResolvedValue(4);
      prisma.sale.create.mockResolvedValue({ id: 9 });
      prisma.invoice.create.mockResolvedValue({ id: 2 });
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });
      prisma.apartado.update.mockResolvedValue(
        activeApartado({ status: 'paid', saleId: 9 }),
      );

      const result = await service.addPayment(
        1,
        { amount: 20000, paymentMethod: 'cash' },
        3,
        9,
      );

      expect(prisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saleNumber: 'VEN-2026-0005',
            paymentStatus: 'paid',
            receivedAmount: 20000,
          }),
        }),
      );
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paid' }),
        }),
      );
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'sale',
            amount: 20000,
            saleId: 9,
            apartadoId: 1,
          }),
        }),
      );
      expect(prisma.apartado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paid', saleId: 9 }),
        }),
      );
      expect(result.status).toBe('paid');
      expect(result.sale.id).toBe(9);
    });

    it('rejects when the payment exceeds the outstanding balance', async () => {
      prisma.apartado.findFirst.mockResolvedValue(
        activeApartado({ totalPaid: 50000 }),
      );

      await expect(
        service.addPayment(1, { amount: 60000 }, 3, 9),
      ).rejects.toThrow('supera el saldo');
      expect(prisma.cashMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('charges the outstanding balance and creates the sale', async () => {
      prisma.apartado.findFirst.mockResolvedValue(
        activeApartado({ totalPaid: 60000 }),
      );
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.sale.count.mockResolvedValue(9);
      prisma.sale.create.mockResolvedValue({ id: 10 });
      prisma.invoice.create.mockResolvedValue({ id: 3 });
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });
      prisma.apartado.update.mockResolvedValue(
        activeApartado({ status: 'paid', saleId: 10 }),
      );

      const result = await service.complete(1, { paymentMethod: 'card' }, 3, 9);

      expect(prisma.apartadoPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 40000,
            paymentMethod: 'card',
          }),
        }),
      );
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'sale',
            amount: 40000,
            paymentMethod: 'card',
          }),
        }),
      );
      expect(result.sale.id).toBe(10);
    });
  });

  describe('cancel', () => {
    it('restores stock and refunds the paid amount', async () => {
      prisma.apartado.findFirst.mockResolvedValue(
        activeApartado({ totalPaid: 30000 }),
      );
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.product.update.mockResolvedValue({});
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });
      prisma.apartado.update.mockResolvedValue(
        activeApartado({ status: 'cancelled' }),
      );

      await service.cancel(1, { reason: 'Cliente desistió' }, 3, 9);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: { increment: 2 } },
      });
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'refund',
            amount: -30000,
            apartadoId: 1,
          }),
        }),
      );
      expect(prisma.apartado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
    });
  });
});
