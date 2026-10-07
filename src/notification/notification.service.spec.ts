import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from './notification.service';

interface NotificationPrismaMock {
  notification: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
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
      update: jest.fn().mockResolvedValue({ id: 1, readAt: new Date() }),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
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

      const result = await service.list(3, { page: 1, limit: 20 });

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

      await service.list(3, { unread: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 3, readAt: null }),
        }),
      );
    });
  });

  describe('markRead / markAllRead', () => {
    it('marca como leída solo notificaciones de la empresa', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 4 });

      await service.markRead(4, 3);

      expect(prisma.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 4, companyId: 3 } }),
      );
      expect(prisma.notification.update).toHaveBeenCalled();
    });

    it('lanza 404 si la notificación no pertenece a la empresa', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markRead(4, 3)).rejects.toThrow(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('markAllRead actualiza solo las no leídas de la empresa', async () => {
      await service.markAllRead(3);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { companyId: 3, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
