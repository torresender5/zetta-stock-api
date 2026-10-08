import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSubjectService } from './data-subject.service';
import { PrismaService } from '../prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

type FindUniqueArgs = { where: { id: number } };
type CreateArgs = { data: Record<string, unknown> };
type UpdateArgs = { where: { id: number }; data: Record<string, unknown> };

describe('DataSubjectService', () => {
  let service: DataSubjectService;
  let prisma: ReturnType<typeof basePrisma>;

  const basePrisma = () => ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dataSubjectRequest: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const userRow = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    user: 'Ana',
    email: 'ana@mail.com',
    password: 'hash',
    role: 'admin',
    active: true,
    companyId: 3,
    createdAt: new Date('2026-10-01'),
    acceptedTerms: true,
    termsVersion: '1.0',
    acceptedAt: new Date('2026-10-06'),
    company: {
      id: 3,
      name: 'Empresa Ana',
      kind: 'EMPRESA',
      document: 'J-123',
      phoneNumber: '0414',
      address: 'Calle 1',
      currency: 'USD',
      taxRate: 16,
      createdAt: new Date('2026-10-01'),
    },
    consentLogs: [
      {
        type: 'terms',
        version: '1.0',
        acceptedAt: new Date('2026-10-06'),
        ip: '127.0.0.1',
        userAgent: 'jest',
      },
    ],
    dataSubjectRequests: [],
    ...overrides,
  });

  const requestRow = (overrides: Record<string, unknown> = {}) => ({
    id: 11,
    userId: 7,
    type: 'rectificacion',
    motivo: 'Mi correo cambió',
    status: 'pendiente',
    detail: null,
    ip: '127.0.0.1',
    userAgent: 'jest',
    createdAt: new Date(),
    dueAt: new Date(),
    resolvedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = basePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSubjectService,
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

    service = module.get<DataSubjectService>(DataSubjectService);
  });

  describe('exportUserData', () => {
    it('devuelve perfil, empresa, consentimientos y solicitudes sin la contraseña', async () => {
      let findArgs: FindUniqueArgs | undefined;
      prisma.user.findUnique.mockImplementation((args: FindUniqueArgs) => {
        findArgs = args;
        return Promise.resolve(userRow());
      });

      const result = await service.exportUserData(7);

      expect(findArgs?.where).toEqual({ id: 7 });
      expect(result.perfil).toMatchObject({
        id: 7,
        nombre: 'Ana',
        email: 'ana@mail.com',
        aceptoTerminos: true,
      });
      expect(result.empresa).toMatchObject({ nombre: 'Empresa Ana' });
      expect(result.consentimientos).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain('hash');
    });

    it('lanza 404 si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.exportUserData(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRequest', () => {
    const meta = { ip: '127.0.0.1', userAgent: 'jest' };

    it('acceso: se resuelve de inmediato apuntando al export', async () => {
      let updated: UpdateArgs | undefined;
      prisma.dataSubjectRequest.create.mockResolvedValue(
        requestRow({ type: 'acceso' }),
      );
      prisma.dataSubjectRequest.update.mockImplementation(
        (args: UpdateArgs) => {
          updated = args;
          return Promise.resolve(requestRow({ type: 'acceso', ...args.data }));
        },
      );

      const result = await service.createRequest(
        7,
        { type: 'acceso', motivo: 'Quiero copia de mis datos' },
        meta,
      );

      expect(updated?.data.status).toBe('completada');
      expect(result.status).toBe('completada');
      expect(result.detail).toContain('/users/me/export');
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('rectificación: queda pendiente con SLA de 15 días hábiles', async () => {
      let created: CreateArgs | undefined;
      let updated: UpdateArgs | undefined;
      prisma.dataSubjectRequest.create.mockImplementation(
        (args: CreateArgs) => {
          created = args;
          return Promise.resolve(requestRow({ ...args.data, id: 12 }));
        },
      );
      prisma.dataSubjectRequest.update.mockImplementation(
        (args: UpdateArgs) => {
          updated = args;
          return Promise.resolve(requestRow({ id: 12, ...args.data }));
        },
      );

      const result = await service.createRequest(
        7,
        { type: 'rectificacion', motivo: 'Nombre mal escrito en la cuenta' },
        meta,
      );

      expect(created).toBeDefined();
      const dueAt = created?.data.dueAt as Date;
      // 15 días hábiles caen entre 19 y 23 días naturales después.
      const days = (dueAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(18);
      expect(days).toBeLessThan(24);
      expect([0, 6]).not.toContain(dueAt.getDay());
      expect(created?.data.ip).toBe('127.0.0.1');
      expect(created?.data.userAgent).toBe('jest');
      expect(updated?.data.status).toBe('pendiente');
      expect(result.status).toBe('pendiente');
      expect(result.resolvedAt).toBeNull();
    });

    it('revocación: se registra y completa', async () => {
      let updated: UpdateArgs | undefined;
      prisma.dataSubjectRequest.create.mockResolvedValue(
        requestRow({ type: 'revocacion' }),
      );
      prisma.dataSubjectRequest.update.mockImplementation(
        (args: UpdateArgs) => {
          updated = args;
          return Promise.resolve(
            requestRow({ type: 'revocacion', ...args.data }),
          );
        },
      );

      const result = await service.createRequest(
        7,
        { type: 'revocacion', motivo: 'No quiero más comunicaciones' },
        meta,
      );

      expect(updated?.data.status).toBe('completada');
      expect(result.status).toBe('completada');
      expect(result.detail).toContain('revocados');
    });

    it('supresión: baja y anonimiza la cuenta en una transacción', async () => {
      let ops: unknown[] = [];
      let updatedUser: UpdateArgs | undefined;
      let updatedRequest: UpdateArgs | undefined;
      prisma.dataSubjectRequest.create.mockResolvedValue(
        requestRow({ type: 'supresion' }),
      );
      prisma.user.update.mockImplementation((args: UpdateArgs) => {
        updatedUser = args;
        return Promise.resolve(userRow());
      });
      prisma.dataSubjectRequest.update.mockImplementation(
        (args: UpdateArgs) => {
          updatedRequest = args;
          return Promise.resolve(
            requestRow({ type: 'supresion', ...args.data }),
          );
        },
      );
      prisma.$transaction.mockImplementation((batch: unknown[]) => {
        ops = batch;
        return Promise.resolve([
          userRow({ active: false, email: 'anonimo+7@zettastock.invalid' }),
          requestRow({ type: 'supresion', status: 'completada' }),
        ]);
      });

      const result = await service.createRequest(
        7,
        { type: 'supresion', motivo: 'Dejo de usar el servicio' },
        meta,
      );

      expect(ops).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(updatedUser?.where).toEqual({ id: 7 });
      expect(updatedUser?.data).toMatchObject({
        active: false,
        email: 'anonimo+7@zettastock.invalid',
        user: 'Usuario dado de baja',
      });
      expect(updatedUser?.data.password).not.toBe('hash');
      expect(updatedRequest?.where).toEqual({ id: 11 });
      expect(updatedRequest?.data.status).toBe('completada');
      expect(updatedRequest?.data.resolvedAt).toBeInstanceOf(Date);
      expect(result.status).toBe('completada');
    });
  });

  describe('listRequests', () => {
    it('filtra por el titular', async () => {
      let findArgs: { where: { userId: number } } | undefined;
      prisma.dataSubjectRequest.findMany.mockImplementation(
        (args: { where: { userId: number } }) => {
          findArgs = args;
          return Promise.resolve([requestRow()]);
        },
      );

      const result = await service.listRequests(7);

      expect(findArgs?.where).toEqual({ userId: 7 });
      expect(result).toHaveLength(1);
    });
  });
});
