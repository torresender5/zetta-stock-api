import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof basePrisma>;

  const safeRow = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    user: 'vendedor',
    email: 'v@endor.com',
    role: 'vendedor',
    createdAt: new Date('2026-10-01'),
    companyId: 3,
    ...overrides,
  });

  const user = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    user: 'vendedor',
    email: 'v@endor.com',
    password: 'hash',
    role: 'vendedor',
    active: true,
    isDeleted: false,
    companyId: 3,
    ...overrides,
  });

  const basePrisma = () => ({
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
  });

  beforeEach(async () => {
    prisma = basePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
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

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllUsers', () => {
    it('excluye los usuarios eliminados (is_deleted) y aísla por empresa', async () => {
      prisma.user.findMany.mockResolvedValue([safeRow()]);

      const result = await service.findAllUsers(3);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 3, isDeleted: false },
        }),
      );
      expect(result).toEqual([
        {
          id: 7,
          name: 'vendedor',
          email: 'v@endor.com',
          role: 'vendedor',
          createdAt: new Date('2026-10-01'),
          companyId: 3,
        },
      ]);
    });

    it('sin companyId (superadmin) sigue excluyendo los eliminados', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.findAllUsers(undefined);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
        }),
      );
    });
  });

  describe('deleteUser', () => {
    it('desactiva y marca is_deleted en lugar de borrar el registro', async () => {
      prisma.user.findFirst.mockResolvedValue(user());
      prisma.user.update.mockResolvedValue(
        user({ active: false, isDeleted: true }),
      );

      await service.deleteUser(1, 7, 3);

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7, isDeleted: false, companyId: 3 },
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { active: false, isDeleted: true },
      });
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('no permite autoeliminarse', async () => {
      await expect(service.deleteUser(7, 7, 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('lanza 404 si el usuario no existe en la empresa', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.deleteUser(1, 99, 3)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('no devuelve usuarios eliminados', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findById(7, 3)).resolves.toBeNull();

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 7, isDeleted: false, companyId: 3 },
      });
    });
  });

  describe('createUser', () => {
    it('el límite del plan solo cuenta usuarios no eliminados', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: { maxUsers: 2 },
      });
      prisma.user.count.mockResolvedValue(2);

      await expect(
        service.createUser({
          user: 'nuevo',
          email: 'nuevo@mail.com',
          password: 'secret1',
          role: 'vendedor',
          companyId: 3,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { companyId: 3, isDeleted: false },
      });
    });
  });
});
