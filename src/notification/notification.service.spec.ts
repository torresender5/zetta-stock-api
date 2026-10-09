import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from './notification.service';

interface NotificationPrismaMock {
  notification: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
    groupBy: jest.Mock;
  };
  user: { findMany: jest.Mock };
  company: { findMany: jest.Mock };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: NotificationPrismaMock;

  const basePrisma = (): NotificationPrismaMock => ({
    notification: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1, readAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    company: { findMany: jest.fn().mockResolvedValue([]) },
  });

  beforeEach(async () => {
    prisma = basePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        },
      ],
    }).compile();
    service = module.get<NotificationService>(NotificationService);
  });

  describe('notify', () => {
    it('crea la notificación cuando no hay duplicado sin leer', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await service.notify({
        companyId: 3,
        type: 'stock_low',
        title: 'Stock bajo: Camisa',
        dedupeKey: 'stock_low:7',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 3,
          type: 'stock_low',
          title: 'Stock bajo: Camisa',
          dedupeKey: 'stock_low:7',
        }),
      });
    });

    it('no duplica si ya existe una notificación igual sin leer', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 9 });

      await service.notify({
        companyId: 3,
        type: 'stock_low',
        title: 'Stock bajo: Camisa',
        dedupeKey: 'stock_low:7',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('no hace nada sin companyId (superadmin)', async () => {
      await service.notify({ companyId: null, type: 'cash_open', title: 'x' });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('nunca lanza aunque la creación falle', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.notify({ companyId: 3, type: 'cash_open', title: 'x' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('filtra por companyId y devuelve el contador de no leídas', async () => {
      prisma.notification.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);

      const result = await service.list(3, 5, { page: 1, limit: 20 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 3 }),
          skip: 0,
          take: 20,
        }),
      );
      expect(result.meta.total).toBe(5);
      expect(result.unread).toBe(2);
    });

    it('con unread solo cuenta no leídas', async () => {
      prisma.notification.count.mockResolvedValue(1);

      await service.list(3, 5, { unread: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 3, readAt: null }),
        }),
      );
    });

    it('ve las notificaciones de empresa y las suyas propias', async () => {
      await service.list(3, 5);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 3,
            OR: [{ userId: null }, { userId: 5 }],
          }),
        }),
      );
    });

    it('sin usuario (superadmin Basic) no filtra por destinatario', async () => {
      await service.list(3, undefined);

      const where = (
        prisma.notification.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where;
      expect(where.OR).toBeUndefined();
      expect(where.companyId).toBe(3);
    });

    it('scope=tickets solo incluye respuestas de soporte', async () => {
      await service.list(3, 5, { scope: 'tickets' });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'ticket_reply' }),
        }),
      );
    });

    it('scope=general excluye las notificaciones de tickets', async () => {
      await service.list(3, 5, { scope: 'general' });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { not: 'ticket_reply' },
          }),
        }),
      );
    });
  });

  describe('markRead / markAllRead', () => {
    it('marca como leída solo notificaciones de la empresa', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 4 });

      await service.markRead(4, 3, 5);

      expect(prisma.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 4, companyId: 3, OR: [{ userId: null }, { userId: 5 }] },
        }),
      );
      expect(prisma.notification.update).toHaveBeenCalled();
    });

    it('lanza 404 si la notificación no pertenece a la empresa', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markRead(4, 3, 5)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('lanza 404 si la notificación es de otro usuario (no company-wide)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      // La BD no devuelve fila porque el filtro userId excluye la ajena.
      await expect(service.markRead(4, 3, 9)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 4,
            companyId: 3,
            OR: [{ userId: null }, { userId: 9 }],
          },
        }),
      );
    });

    it('markAllRead actualiza solo las no leídas visibles del usuario', async () => {
      await service.markAllRead(3, 5);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: 3,
          readAt: null,
          OR: [{ userId: null }, { userId: 5 }],
        },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('createAnnouncement', () => {
    it('expande un anuncio por empresa con userId null', async () => {
      prisma.company.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await service.createAnnouncement({
        title: 'Mantenimiento',
        targets: { kind: 'all_companies' },
      });

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            companyId: 1,
            userId: null,
            type: 'announcement',
            title: 'Mantenimiento',
            targetLabel: 'Todas las empresas',
          }),
          expect.objectContaining({
            companyId: 2,
            userId: null,
            type: 'announcement',
          }),
        ]),
      });
      expect(result.count).toBe(2);
      expect(result.targetLabel).toBe('Todas las empresas');
      expect(result.dedupeKey).toMatch(/^announcement:/);
    });

    it('asigna por rol con una fila por usuario', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 10, companyId: 3 },
        { id: 11, companyId: 4 },
      ]);

      const result = await service.createAnnouncement({
        title: 'Nueva función',
        body: 'Detalle',
        targets: { kind: 'role', role: 'vendedor' },
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'vendedor' }),
        }),
      );
      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ companyId: 3, userId: 10 }),
          expect.objectContaining({ companyId: 4, userId: 11 }),
        ],
      });
      expect(result.targetLabel).toBe('Rol: Vendedor');
      expect(result.count).toBe(2);
    });

    it('asigna a usuarios concretos solo de empresas activas', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 7, companyId: 9 }]);

      const result = await service.createAnnouncement({
        title: 'Hola',
        targets: { kind: 'user', userIds: [7, 99] },
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [7, 99] },
            active: true,
            isDeleted: false,
          }),
        }),
      );
      expect(result.count).toBe(1);
      expect(
        (prisma.notification.createMany.mock.calls[0][0].data as unknown[])[0],
      ).toEqual(
        expect.objectContaining({
          companyId: 9,
          userId: 7,
          type: 'announcement',
        }),
      );
    });

    it('sin destinatarios válidos lanza BadRequest', async () => {
      prisma.company.findMany.mockResolvedValue([]);

      await expect(
        service.createAnnouncement({
          title: 'X',
          targets: { kind: 'company', companyIds: [999] },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('sin userIds para kind=user lanza BadRequest', async () => {
      await expect(
        service.createAnnouncement({
          title: 'X',
          targets: { kind: 'user' },
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('sin rol para kind=role lanza BadRequest', async () => {
      await expect(
        service.createAnnouncement({
          title: 'X',
          targets: { kind: 'role' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listAnnouncements', () => {
    it('agrupa por dedupeKey con destinatarios y leídas', async () => {
      prisma.notification.findMany.mockResolvedValue([
        {
          dedupeKey: 'announcement:a',
          title: 'T1',
          body: 'B1',
          targetLabel: 'Todas las empresas',
          createdAt: new Date('2026-10-08'),
        },
      ]);
      prisma.notification.groupBy
        .mockResolvedValueOnce([{ dedupeKey: 'announcement:a' }]) // total
        .mockResolvedValueOnce([
          { dedupeKey: 'announcement:a', _count: { _all: 12 } },
        ]) // destinatarios
        .mockResolvedValueOnce([
          { dedupeKey: 'announcement:a', _count: { _all: 4 } },
        ]); // leídas

      const result = await service.listAnnouncements({ page: 1, limit: 20 });

      expect(result.meta.total).toBe(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          dedupeKey: 'announcement:a',
          title: 'T1',
          targetLabel: 'Todas las empresas',
          recipients: 12,
          readCount: 4,
        }),
      );
    });
  });
});
