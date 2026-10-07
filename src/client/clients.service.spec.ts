import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: ReturnType<typeof basePrisma>;

  const client = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    companyId: 3,
    name: 'Cliente',
    email: 'cliente@mail.com',
    document: '123',
    phone: '300',
    address: 'Calle 1',
    createdAt: new Date('2026-10-05'),
    ...overrides,
  });

  const basePrisma = () => ({
    client: {
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
        ClientsService,
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

    service = module.get<ClientsService>(ClientsService);
  });

  describe('findAll', () => {
    it('acota la búsqueda a la empresa y pagina en el servidor', async () => {
      prisma.client.findMany.mockResolvedValue([client()]);
      prisma.client.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'cliente' },
        3,
      );

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 3,
            OR: expect.arrayContaining([
              { name: expect.objectContaining({ contains: 'cliente' }) },
            ]),
          }),
          skip: 0,
          take: 10,
        }),
      );
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('no filtra por empresa cuando no se envía companyId (superadmin)', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(0);

      await service.findAll({}, undefined);

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('findAllDropdown', () => {
    it('devuelve solo los clientes de la empresa', async () => {
      prisma.client.findMany.mockResolvedValue([client()]);

      await service.findAllDropdown(3);

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { companyId: 3 },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById / findByEmail', () => {
    it('aisla la consulta por companyId', async () => {
      prisma.client.findFirst.mockResolvedValue(client());

      const result = await service.findById(5, 3);

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 5, companyId: 3 },
      });
      expect(result?.id).toBe(5);
    });

    it('devuelve null cuando el cliente es de otra empresa', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.findByEmail('cliente@mail.com', 3),
      ).resolves.toBeNull();
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { email: 'cliente@mail.com', companyId: 3 },
      });
    });
  });

  describe('create', () => {
    it('inyecta el companyId del usuario autenticado', async () => {
      prisma.client.create.mockResolvedValue(client());

      const result = await service.create(
        { name: 'Cliente', email: 'cliente@mail.com' },
        3,
      );

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: { name: 'Cliente', email: 'cliente@mail.com', companyId: 3 },
      });
      expect(result.companyId).toBe(3);
    });
  });

  describe('update', () => {
    it('actualiza un cliente de la misma empresa', async () => {
      prisma.client.findFirst.mockResolvedValue(client());
      prisma.client.update.mockResolvedValue(client({ name: 'Nuevo' }));

      await service.update(5, { name: 'Nuevo' }, 3);

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 5, companyId: 3 },
      });
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { name: 'Nuevo' },
      });
    });

    it('rechaza actualizar un cliente de otra empresa', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.update(5, { name: 'Nuevo' }, 3)).rejects.toThrow(
        'Cliente no encontrado',
      );
      expect(prisma.client.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('elimina un cliente de la misma empresa', async () => {
      prisma.client.findFirst.mockResolvedValue(client());
      prisma.client.delete.mockResolvedValue(client());

      await service.delete(5, 3);

      expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('rechaza eliminar un cliente de otra empresa', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.delete(5, 3)).rejects.toThrow(
        'Cliente no encontrado',
      );
      expect(prisma.client.delete).not.toHaveBeenCalled();
    });
  });
});
