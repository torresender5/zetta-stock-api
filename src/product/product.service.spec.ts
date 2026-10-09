import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('ProductService', () => {
  let service: ProductService;
  let prismaMock: {
    product: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    category: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prismaMock = {
      product: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: R2Service,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
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

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByBarcode', () => {
    it('devuelve el producto cuando el barcode existe en la empresa', async () => {
      const product = { id: 7, barcode: '7501234567890', name: 'Café' };
      prismaMock.product.findFirst.mockResolvedValue(product);

      const result = await service.findByBarcode('7501234567890', 3);

      expect(result).toEqual(product);
      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: { barcode: '7501234567890', companyId: 3 },
      });
    });

    it('lanza NotFoundException cuando el barcode no existe', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      await expect(service.findByBarcode('0000000000000', 3)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza BadRequestException con barcode vacío', async () => {
      await expect(service.findByBarcode('   ', 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    });

    it('busca sin filtro de empresa cuando no hay companyId (UserAdmin)', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ id: 1 });

      await service.findByBarcode('7501234567890');

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: { barcode: '7501234567890' },
      });
    });
  });

  describe('create (barcode)', () => {
    const baseData = {
      name: 'Café',
      code: 'PROD-1',
      sku: 'SKU-1',
      type: 'bebida',
      category: 'General',
      purchasePrice: 1000,
      salePrice: 2000,
      stock: 10,
      barcode: ' 7501234567890 ',
    };

    it('normaliza el barcode y lo guarda si es único', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 1, ...data }),
      );

      await service.create(baseData, undefined, 3);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: { barcode: '7501234567890', companyId: 3 },
        select: { id: true, name: true },
      });
      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          barcode: '7501234567890',
        }) as Record<string, unknown>,
      });
    });

    it('rechaza barcode duplicado dentro de la empresa', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);
      prismaMock.product.findFirst.mockResolvedValue({
        id: 9,
        name: 'Otro producto',
      });

      await expect(service.create(baseData, undefined, 3)).rejects.toThrow(
        'Código de barras ya registrado en otro producto',
      );
      expect(prismaMock.product.create).not.toHaveBeenCalled();
    });

    it('convierte barcode vacío en null', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);
      prismaMock.product.findFirst.mockResolvedValue(null);
      prismaMock.product.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 1, ...data }),
      );

      await service.create({ ...baseData, barcode: '   ' }, undefined, 3);

      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          barcode: null,
        }) as Record<string, unknown>,
      });
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update (barcode)', () => {
    it('permite mantener el propio barcode al editar', async () => {
      prismaMock.product.findFirst
        .mockResolvedValueOnce({ id: 5, barcode: '7501234567890' })
        .mockResolvedValueOnce(null);
      prismaMock.product.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 5, ...data }),
      );

      await service.update(5, { barcode: '7501234567890' }, undefined, 3);

      expect(prismaMock.product.findFirst).toHaveBeenLastCalledWith({
        where: { barcode: '7501234567890', companyId: 3, id: { not: 5 } },
        select: { id: true, name: true },
      });
      expect(prismaMock.product.update).toHaveBeenCalled();
    });

    it('rechaza barcode que ya pertenece a otro producto', async () => {
      prismaMock.product.findFirst
        .mockResolvedValueOnce({ id: 5, barcode: null })
        .mockResolvedValueOnce({ id: 8, name: 'Otro' });

      await expect(
        service.update(5, { barcode: '7501234567890' }, undefined, 3),
      ).rejects.toThrow('Código de barras ya registrado en otro producto');
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });
  });
});
