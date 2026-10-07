import { Test, TestingModule } from '@nestjs/testing';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('SupplierService', () => {
  let service: SupplierService;
  let prisma: ReturnType<typeof basePrisma>;

  const supplier = (overrides: Record<string, unknown> = {}) => ({
    id: 4,
    companyId: 3,
    name: 'Proveedor',
    email: 'proveedor@mail.com',
    document: '900',
    phone: '301',
    address: 'Carrera 2',
    createdAt: new Date('2026-10-05'),
    ...overrides,
  });

  const basePrisma = () => ({
    supplier: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  });

  beforeEach(async () => {
    prisma = basePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
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

    service = module.get<SupplierService>(SupplierService);
  });

  describe('findAll', () => {
    it('devuelve solo proveedores de la empresa', async () => {
      prisma.supplier.findMany.mockResolvedValue([supplier()]);

      await service.findAll(3);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: { companyId: 3 },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('sin companyId no filtra (superadmin global)', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await service.findAll(undefined);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findAllPaginated', () => {
    it('filtra por empresa y busca por nombre/documento', async () => {
      prisma.supplier.findMany.mockResolvedValue([supplier()]);
      prisma.supplier.count.mockResolvedValue(1);

      const result = await service.findAllPaginated(
        { page: 2, limit: 5, search: 'prov' },
        3,
      );

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 3,
            OR: expect.arrayContaining([
              { name: expect.objectContaining({ contains: 'prov' }) },
            ]),
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

  describe('findById', () => {
    it('aisla la consulta por companyId', async () => {
      prisma.supplier.findFirst.mockResolvedValue(supplier());

      const result = await service.findById(4, 3);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 4, companyId: 3 },
      });
      expect(result?.id).toBe(4);
    });

    it('devuelve null para un proveedor de otra empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findById(4, 9)).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('inyecta el companyId del usuario autenticado', async () => {
      prisma.supplier.create.mockResolvedValue(supplier());

      const result = await service.create({ name: 'Proveedor' }, 3);

      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: { name: 'Proveedor', companyId: 3 },
      });
      expect(result.companyId).toBe(3);
    });
  });

  describe('update', () => {
    it('actualiza un proveedor de la misma empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(supplier());
      prisma.supplier.update.mockResolvedValue(supplier({ name: 'Nuevo' }));

      await service.update(4, { name: 'Nuevo' }, 3);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 4, companyId: 3 },
      });
      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { name: 'Nuevo' },
      });
    });

    it('rechaza actualizar un proveedor de otra empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.update(4, { name: 'Nuevo' }, 3)).rejects.toThrow(
        'Proveedor no encontrado',
      );
      expect(prisma.supplier.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('elimina un proveedor de la misma empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(supplier());
      prisma.supplier.delete.mockResolvedValue(supplier());

      await service.delete(4, 3);

      expect(prisma.supplier.delete).toHaveBeenCalledWith({ where: { id: 4 } });
    });

    it('rechaza eliminar un proveedor de otra empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.delete(4, 3)).rejects.toThrow(
        'Proveedor no encontrado',
      );
      expect(prisma.supplier.delete).not.toHaveBeenCalled();
    });
  });
});
