import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let prisma: ReturnType<typeof basePrisma>;

  const year = new Date().getFullYear();

  const purchase = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    purchaseNumber: `COMP-${year}-0001`,
    companyId: 3,
    supplierId: 4,
    date: new Date('2026-10-05'),
    subtotal: 27000,
    tax: 5130,
    total: 32130,
    paymentStatus: 'pending',
    items: [
      {
        id: 10,
        productId: 2,
        productName: 'Producto',
        size: null,
        quantity: 3,
        unitPrice: 9000,
        subtotal: 27000,
      },
    ],
    ...overrides,
  });

  const basePrisma = () => ({
    purchase: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    purchaseItem: { deleteMany: jest.fn() },
    supplier: { findFirst: jest.fn(), findMany: jest.fn() },
    company: { findUnique: jest.fn() },
    product: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  });

  const createDto = (overrides: Record<string, unknown> = {}) => ({
    supplierId: 4,
    date: '2026-10-05',
    paymentStatus: 'pending',
    items: [
      {
        productId: 2,
        productName: 'Producto',
        quantity: 3,
        unitPrice: 9000,
        subtotal: 27000,
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = basePrisma();
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
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

    service = module.get<PurchaseService>(PurchaseService);
  });

  describe('create', () => {
    const arrangeCreate = () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 4 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        stock: 5,
        purchasePrice: 8000,
        sizes: [],
      });
      prisma.purchase.count.mockResolvedValue(0);
      prisma.purchase.create.mockResolvedValue(purchase());
      prisma.product.update.mockResolvedValue({});
    };

    it('incrementa el stock y actualiza el precio de compra', async () => {
      arrangeCreate();

      const result = await service.create(createDto(), 3);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 4, companyId: 3 },
      });
      expect(prisma.purchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchaseNumber: `COMP-${year}-0001`,
            companyId: 3,
            subtotal: 27000,
            tax: 5130,
            total: 32130,
            paymentStatus: 'pending',
          }),
        }),
      );
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: 8, purchasePrice: 9000 },
      });
      expect(result.purchaseNumber).toBe(`COMP-${year}-0001`);
    });

    it('suma la talla comprada al stock de esa talla', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 4 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        stock: 10,
        sizes: [
          { size: 'M', stock: 4 },
          { size: 'L', stock: 6 },
        ],
      });
      prisma.purchase.count.mockResolvedValue(0);
      prisma.purchase.create.mockResolvedValue(purchase());
      prisma.product.update.mockResolvedValue({});

      await service.create(
        createDto({
          items: [
            {
              productId: 2,
              productName: 'Producto',
              size: 'M',
              quantity: 3,
              unitPrice: 9000,
              subtotal: 27000,
            },
          ],
        }),
        3,
      );

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: {
          stock: 13,
          sizes: [
            { size: 'M', stock: 7 },
            { size: 'L', stock: 6 },
          ],
          purchasePrice: 9000,
        },
      });
    });

    it('rechaza la compra si el proveedor es de otra empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto(), 3)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.purchase.create).not.toHaveBeenCalled();
    });

    it('rechaza productos que no pertenecen a la empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 4 });
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto(), 3)).rejects.toThrow(
        'Producto 2 no encontrado',
      );
      expect(prisma.purchase.create).not.toHaveBeenCalled();
    });

    it('exige talla cuando el producto maneja tallas', async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: 4 });
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        stock: 10,
        sizes: [{ size: 'M', stock: 4 }],
      });
      prisma.purchase.count.mockResolvedValue(0);
      prisma.purchase.create.mockResolvedValue(purchase());

      await expect(service.create(createDto(), 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('actualiza solo metadatos (proveedor, fecha y estado de pago)', async () => {
      prisma.purchase.findFirst.mockResolvedValue(purchase());
      prisma.supplier.findFirst.mockResolvedValue({ id: 8 });
      prisma.purchase.update.mockResolvedValue(purchase({ supplierId: 8 }));

      const result = await service.update(
        1,
        { supplierId: 8, date: '2026-10-06', paymentStatus: 'paid' },
        3,
      );

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 8, companyId: 3 },
      });
      expect(prisma.purchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: {
            supplierId: 8,
            date: new Date('2026-10-06'),
            paymentStatus: 'paid',
          },
        }),
      );
      expect(result.supplierId).toBe(8);
    });

    it('rechaza un proveedor de otra empresa', async () => {
      prisma.purchase.findFirst.mockResolvedValue(purchase());
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.update(1, { supplierId: 99 }, 3)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.purchase.update).not.toHaveBeenCalled();
    });

    it('lanza 404 cuando la compra no pertenece a la empresa', async () => {
      prisma.purchase.findFirst.mockResolvedValue(null);

      await expect(
        service.update(9, { paymentStatus: 'paid' }, 3),
      ).rejects.toThrow('Compra no encontrada');
    });
  });

  describe('remove', () => {
    it('revierte el stock y elimina la compra con sus líneas', async () => {
      prisma.purchase.findFirst.mockResolvedValue(purchase());
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        stock: 8,
        sizes: [],
      });
      prisma.product.update.mockResolvedValue({});
      prisma.purchaseItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.purchase.delete.mockResolvedValue(purchase());

      const result = await service.remove(1, 3);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: 5 },
      });
      expect(prisma.purchaseItem.deleteMany).toHaveBeenCalledWith({
        where: { purchaseId: 1 },
      });
      expect(prisma.purchase.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.id).toBe(1);
    });

    it('revierte la talla comprada y no deja stock negativo', async () => {
      prisma.purchase.findFirst.mockResolvedValue(
        purchase({
          items: [
            {
              id: 10,
              productId: 2,
              productName: 'Producto',
              size: 'M',
              quantity: 3,
              unitPrice: 9000,
              subtotal: 27000,
            },
          ],
        }),
      );
      prisma.product.findFirst.mockResolvedValue({
        id: 2,
        name: 'Producto',
        stock: 1,
        sizes: [{ size: 'M', stock: 1 }],
      });
      prisma.product.update.mockResolvedValue({});
      prisma.purchaseItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.purchase.delete.mockResolvedValue({});

      await service.remove(1, 3);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stock: 0, sizes: [{ size: 'M', stock: 0 }] },
      });
    });

    it('lanza 404 y no toca el stock si la compra no existe', async () => {
      prisma.purchase.findFirst.mockResolvedValue(null);

      await expect(service.remove(9, 3)).rejects.toThrow(
        'Compra no encontrada',
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.purchase.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filtra por empresa y pagina en el servidor', async () => {
      prisma.purchase.findMany.mockResolvedValue([purchase()]);
      prisma.purchase.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 2, limit: 5, paymentStatus: 'paid' },
        3,
      );

      expect(prisma.purchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 3,
            paymentStatus: 'paid',
          }),
          skip: 5,
          take: 5,
        }),
      );
      expect(result.meta).toEqual({
        total: 1,
        page: 2,
        limit: 5,
        totalPages: 1,
      });
    });
  });
});
