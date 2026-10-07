import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SaleService } from './sale.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('SaleService', () => {
  let service: SaleService;
  let prisma: ReturnType<typeof basePrisma>;

  const year = new Date().getFullYear();

  const paidSale = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    saleNumber: `VEN-${year}-0001`,
    companyId: 3,
    clientId: 5,
    date: new Date('2026-10-05'),
    subtotal: 20000,
    tax: 3800,
    total: 23800,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    receivedAmount: null,
    changeAmount: null,
    fxRate: null,
    items: [{ productId: 2, quantity: 2, size: null, subtotal: 20000 }],
    ...overrides,
  });

  const basePrisma = () => ({
    sale: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    saleItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    invoice: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    cashRegister: { findFirst: jest.fn() },
    company: { findUnique: jest.fn() },
    cashMovement: { create: jest.fn() },
    product: { findFirst: jest.fn(), update: jest.fn() },
    client: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  });

  const createDto = (overrides: Record<string, unknown> = {}) => ({
    clientId: 5,
    date: '2026-10-05',
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    items: [
      {
        productId: 2,
        productName: 'Producto',
        quantity: 2,
        unitPrice: 10000,
        subtotal: 20000,
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = basePrisma();
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleService,
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

    service = module.get<SaleService>(SaleService);
  });

  describe('create', () => {
    const arrangeCreate = () => {
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.client.findFirst.mockResolvedValue({
        id: 5,
        name: 'Cliente',
        document: '123',
        address: 'Calle 1',
      });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        stock: 10,
        sizes: [],
      });
      prisma.sale.count.mockResolvedValue(0);
      prisma.sale.create.mockResolvedValue(paidSale());
      prisma.invoice.create.mockResolvedValue({ id: 9 });
      prisma.product.update.mockResolvedValue({});
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });
    };

    it('calcula IVA del 19%, crea factura y movimiento de caja', async () => {
      arrangeCreate();

      const result = await service.create(createDto(), 3, 9);

      expect(prisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saleNumber: `VEN-${year}-0001`,
            companyId: 3,
            subtotal: 20000,
            tax: 3800,
            total: 23800,
            paymentStatus: 'paid',
          }),
        }),
      );
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'paid',
            subtotal: 20000,
            tax: 3800,
            total: 23800,
            clientName: 'Cliente',
          }),
        }),
      );
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'sale',
            amount: 23800,
            cashRegisterId: 7,
            companyId: 3,
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ sale: expect.any(Object) }),
      );
    });

    it('usa el % IVA y los prefijos de la configuración de la empresa', async () => {
      arrangeCreate();
      prisma.company.findUnique.mockResolvedValue({
        id: 3,
        name: 'Empresa',
        taxRate: 16,
        salePrefix: 'VTA',
        invoicePrefix: 'FE',
      });

      await service.create(createDto(), 3, 9);

      expect(prisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saleNumber: `VTA-${year}-0001`,
            subtotal: 20000,
            tax: 3200,
            total: 23200,
          }),
        }),
      );
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNumber: expect.stringMatching(/^FE-\d{4}-\d{4}$/),
            tax: 3200,
          }),
        }),
      );
    });

    it('descuenta el stock de los productos vendidos', async () => {
      arrangeCreate();

      await service.create(createDto(), 3, 9);

      expect(prisma.cashRegister.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'open', companyId: 3 }),
        }),
      );
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: 8 },
      });
    });

    it('rechaza la venta cuando no hay caja abierta', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto(), 3, 9)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.create(createDto({ paymentStatus: 'pending' }), 3, 9),
      ).rejects.toThrow('No hay una caja abierta');
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });

    it('no registra movimiento de caja cuando la venta queda pendiente', async () => {
      arrangeCreate();

      await service.create(createDto({ paymentStatus: 'pending' }), 3, 9);

      expect(prisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentStatus: 'pending' }),
        }),
      );
      expect(prisma.cashMovement.create).not.toHaveBeenCalled();
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('rechaza productos de otra empresa', async () => {
      prisma.cashRegister.findFirst.mockResolvedValue({ id: 7 });
      prisma.client.findFirst.mockResolvedValue({
        id: 5,
        name: 'Cliente',
        document: '123',
        address: 'Calle 1',
      });
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto(), 3, 9)).rejects.toThrow(
        'Product 2 not found',
      );
      expect(prisma.sale.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus', () => {
    const register = { id: 7 };

    it('cancela una venta pagada: devuelve stock, anula factura y registra reembolso', async () => {
      prisma.sale.findFirst.mockResolvedValue(paidSale());
      prisma.cashRegister.findFirst.mockResolvedValue(register);
      prisma.sale.update.mockResolvedValue(
        paidSale({ paymentStatus: 'cancelled' }),
      );
      prisma.product.update.mockResolvedValue({});
      prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });

      const result = await service.updatePaymentStatus(
        1,
        'cancelled',
        3,
        'Venta por error',
        20000,
        'tarjeta',
        undefined,
        9,
      );

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: { increment: 2 } },
      });
      expect(prisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: 'cancelled',
            cancelledReason: 'Venta por error',
            refundAmount: 20000,
            refundMethod: 'tarjeta',
          }),
        }),
      );
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'refund',
            amount: -20000,
            paymentMethod: 'card',
            cashRegisterId: 7,
          }),
        }),
      );
      expect(result.paymentStatus).toBe('cancelled');
    });

    it('exige caja abierta para cancelar una venta pagada', async () => {
      prisma.sale.findFirst.mockResolvedValue(paidSale());
      prisma.cashRegister.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePaymentStatus(
          1,
          'cancelled',
          3,
          'Motivo',
          1000,
          'cash',
          undefined,
          9,
        ),
      ).rejects.toThrow('No hay una caja abierta');
      expect(prisma.sale.update).not.toHaveBeenCalled();
    });

    it('cobra una venta pendiente con movimiento de caja', async () => {
      prisma.sale.findFirst.mockResolvedValue(
        paidSale({ paymentStatus: 'pending' }),
      );
      prisma.cashRegister.findFirst.mockResolvedValue(register);
      prisma.sale.update.mockResolvedValue(paidSale());
      prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });

      await service.updatePaymentStatus(
        1,
        'paid',
        3,
        undefined,
        undefined,
        undefined,
        'card',
        9,
      );

      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'sale',
            amount: 23800,
            paymentMethod: 'card',
          }),
        }),
      );
      expect(prisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: 'paid',
            paymentMethod: 'card',
          }),
        }),
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('revierte el cobro al volver a pendiente', async () => {
      prisma.sale.findFirst.mockResolvedValue(paidSale());
      prisma.cashRegister.findFirst.mockResolvedValue(register);
      prisma.sale.update.mockResolvedValue(
        paidSale({ paymentStatus: 'pending' }),
      );
      prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
      prisma.cashMovement.create.mockResolvedValue({ id: 1 });

      await service.updatePaymentStatus(
        1,
        'pending',
        3,
        undefined,
        undefined,
        undefined,
        undefined,
        9,
      );

      expect(prisma.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: -23800 }),
        }),
      );
    });

    it('no pide caja abierta cuando no se mueve dinero', async () => {
      prisma.sale.findFirst.mockResolvedValue(
        paidSale({ paymentStatus: 'pending' }),
      );
      prisma.sale.update.mockResolvedValue(paidSale());
      prisma.invoice.updateMany.mockResolvedValue({ count: 1 });

      await service.updatePaymentStatus(
        1,
        'cancelled',
        3,
        'Sin stock',
        undefined,
        undefined,
        undefined,
        9,
      );

      expect(prisma.cashRegister.findFirst).not.toHaveBeenCalled();
      expect(prisma.cashMovement.create).not.toHaveBeenCalled();
      expect(prisma.sale.update).toHaveBeenCalled();
    });

    it('lanza cuando la venta no existe', async () => {
      prisma.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePaymentStatus(
          99,
          'paid',
          3,
          undefined,
          undefined,
          undefined,
          undefined,
          9,
        ),
      ).rejects.toThrow('Venta no encontrada');
    });
  });

  describe('update', () => {
    it('permite editar solo las notas de una venta pagada', async () => {
      prisma.sale.findFirst.mockResolvedValue(paidSale());
      prisma.sale.update.mockResolvedValue(paidSale({ notes: 'Nota' }));

      const result = await service.update(1, { notes: 'Nota' }, 3);

      expect(prisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { notes: 'Nota' } }),
      );
      expect(result.notes).toBe('Nota');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza editar líneas de una venta que no está pendiente', async () => {
      prisma.sale.findFirst.mockResolvedValue(paidSale());

      await expect(
        service.update(
          1,
          {
            items: [
              {
                productId: 2,
                productName: 'Producto',
                quantity: 1,
                unitPrice: 10000,
                subtotal: 10000,
              },
            ],
          },
          3,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.sale.update).not.toHaveBeenCalled();
    });

    it('rechaza peticiones sin cambios', async () => {
      prisma.sale.findFirst.mockResolvedValue(paidSale());

      await expect(service.update(1, {}, 3)).rejects.toThrow(
        'No se enviaron cambios para aplicar',
      );
    });

    it('lanza 404 cuando la venta no pertenece a la empresa', async () => {
      prisma.sale.findFirst.mockResolvedValue(null);

      await expect(service.update(9, { notes: 'x' }, 3)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
