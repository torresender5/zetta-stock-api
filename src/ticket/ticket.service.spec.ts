import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { R2Service } from '../r2/r2.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('TicketService', () => {
  let service: TicketService;
  let prisma: ReturnType<typeof basePrisma>;
  let notifications: { notify: jest.Mock };
  let r2: { uploadFile: jest.Mock; deleteFile: jest.Mock };

  const user = (overrides: Record<string, unknown> = {}) => ({
    sub: 7,
    name: 'Ana Admin',
    email: 'ana@mail.com',
    role: 'admin',
    companyId: 3,
    ...overrides,
  });

  const ticket = (overrides: Record<string, unknown> = {}) => ({
    id: 10,
    companyId: 3,
    subject: 'Falla al facturar',
    category: 'falla',
    status: 'abierto',
    image: null,
    companyReadAt: null,
    createdAt: new Date('2026-10-07'),
    updatedAt: new Date('2026-10-07'),
    ...overrides,
  });

  const basePrisma = () => ({
    ticket: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  });

  beforeEach(async () => {
    prisma = basePrisma();
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    r2 = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notifications },
        { provide: R2Service, useValue: r2 },
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

    service = module.get<TicketService>(TicketService);
  });

  describe('findAll', () => {
    it('acota la búsqueda a la empresa y pagina en el servidor', async () => {
      prisma.ticket.findMany.mockResolvedValue([
        {
          ...ticket(),
          messages: [{ createdAt: new Date('2026-10-07'), body: 'Hola' }],
        },
      ]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'facturar' },
        3,
      );

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 3,
            OR: expect.arrayContaining([
              { subject: expect.objectContaining({ contains: 'facturar' }) },
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
      expect(result.data[0].lastMessageAt).toEqual(new Date('2026-10-07'));
      expect(result.data[0].lastMessagePreview).toBe('Hola');
    });

    it('filtra por estado cuando se solicita', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll({ status: 'finalizado' }, 3);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'finalizado' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('crea el ticket de la empresa con el mensaje inicial', async () => {
      prisma.ticket.create.mockResolvedValue(ticket());

      await service.create(
        { subject: 'Falla al facturar', category: 'falla', body: 'Detalles' },
        user(),
      );

      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 3,
            subject: 'Falla al facturar',
            messages: {
              create: expect.objectContaining({
                authorKind: 'empresa',
                authorId: 7,
                authorName: 'Ana Admin',
                body: 'Detalles',
              }),
            },
          }),
        }),
      );
      expect(r2.uploadFile).not.toHaveBeenCalled();
    });

    it('sube la captura a R2 cuando se adjunta imagen', async () => {
      r2.uploadFile.mockResolvedValue('https://cdn/tickets/a.png');
      prisma.ticket.create.mockResolvedValue(ticket());

      await service.create(
        { subject: 'Pago suscripción', category: 'pago', body: 'Captura' },
        user(),
        { originalname: 'pago.png' } as Express.Multer.File,
      );

      expect(r2.uploadFile).toHaveBeenCalledWith('tickets', expect.anything());
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ image: 'https://cdn/tickets/a.png' }),
        }),
      );
    });

    it('borra la imagen subida si la creación falla', async () => {
      r2.uploadFile.mockResolvedValue('https://cdn/tickets/a.png');
      prisma.ticket.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.create(
          { subject: 'Pago suscripción', category: 'pago', body: 'Captura' },
          user(),
          { originalname: 'pago.png' } as Express.Multer.File,
        ),
      ).rejects.toThrow('db down');
      expect(r2.deleteFile).toHaveBeenCalledWith('https://cdn/tickets/a.png');
    });
  });

  describe('getDetail', () => {
    it('marca el hilo como leído por la empresa', async () => {
      prisma.ticket.findFirst.mockResolvedValue(ticket());
      prisma.ticket.update.mockResolvedValue({
        ...ticket(),
        companyReadAt: new Date(),
      });

      await service.getDetail(10, 3);

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 10, companyId: 3 },
      });
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { companyReadAt: expect.any(Date) },
        }),
      );
    });

    it('rechaza ver un ticket de otra empresa', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.getDetail(10, 3)).rejects.toThrow(
        'Ticket no encontrado',
      );
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('addCompanyMessage', () => {
    it('reabre el ticket cuando la empresa responde tras cerrarlo', async () => {
      prisma.ticket.findFirst.mockResolvedValue(
        ticket({ id: 10, status: 'finalizado' }),
      );
      prisma.ticket.update.mockResolvedValue(ticket({ status: 'abierto' }));

      await service.addCompanyMessage(10, 'Sigue el error', user());

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'abierto',
            messages: {
              create: expect.objectContaining({ authorKind: 'empresa' }),
            },
          }),
        }),
      );
    });

    it('devuelve el ticket a "en proceso" cuando responde al soporte', async () => {
      prisma.ticket.findFirst.mockResolvedValue(
        ticket({ id: 10, status: 'pendiente' }),
      );
      prisma.ticket.update.mockResolvedValue(ticket({ status: 'en_proceso' }));

      await service.addCompanyMessage(10, 'Adjunto los datos', user());

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'en_proceso' }),
        }),
      );
    });

    it('rechaza responder un ticket de otra empresa', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.addCompanyMessage(10, 'Hola', user()),
      ).rejects.toThrow('Ticket no encontrado');
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('updateCompanyStatus', () => {
    it('permite a la empresa cerrar su ticket', async () => {
      prisma.ticket.findFirst.mockResolvedValue(ticket());
      prisma.ticket.update.mockResolvedValue(ticket({ status: 'finalizado' }));

      await service.updateCompanyStatus(10, 'finalizado', 3);

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'finalizado' } }),
      );
    });

    it('no permite a la empresa poner estados del soporte', async () => {
      await expect(
        service.updateCompanyStatus(10, 'en_proceso', 3),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('adminAddMessage', () => {
    it('toma el ticket "abierto" como "en proceso" y avisa a la empresa', async () => {
      prisma.ticket.findFirst.mockResolvedValue(
        ticket({ status: 'abierto', subject: 'Falla al facturar' }),
      );
      prisma.ticket.update.mockResolvedValue(ticket({ status: 'en_proceso' }));

      await service.adminAddMessage(
        10,
        'Revisando tu caso',
        user({ sub: 1, companyId: undefined }),
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'en_proceso',
            messages: {
              create: expect.objectContaining({ authorKind: 'soporte' }),
            },
          }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 3,
          type: 'ticket_reply',
          dedupeKey: 'ticket_reply:10',
        }),
      );
    });

    it('conserva el estado cuando el ticket ya está en gestión', async () => {
      prisma.ticket.findFirst.mockResolvedValue(
        ticket({ status: 'en_proceso' }),
      );
      prisma.ticket.update.mockResolvedValue(ticket({ status: 'en_proceso' }));

      await service.adminAddMessage(
        10,
        'Ok',
        user({ sub: 1, companyId: undefined }),
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'en_proceso' }),
        }),
      );
    });

    it('rechaza responder un ticket inexistente sin avisar', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.adminAddMessage(99, 'Hola', user({ sub: 1 })),
      ).rejects.toThrow(NotFoundException);
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('adminUpdateStatus', () => {
    it('permite al soporte marcar pendiente', async () => {
      prisma.ticket.findFirst.mockResolvedValue(ticket());
      prisma.ticket.update.mockResolvedValue(ticket({ status: 'pendiente' }));

      await service.adminUpdateStatus(10, 'pendiente');

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'pendiente' } }),
      );
    });

    it('rechaza estados fuera de los permitidos para el soporte', async () => {
      await expect(service.adminUpdateStatus(10, 'abierto')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('adminFindAll', () => {
    it('agrupa por empresa y permite filtrar por companyId', async () => {
      prisma.ticket.findMany.mockResolvedValue([
        {
          ...ticket(),
          company: { id: 3, name: 'Mi Empresa', kind: 'EMPRESA' },
          messages: [{ createdAt: new Date('2026-10-07'), body: 'Hola' }],
        },
      ]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await service.adminFindAll({ companyId: 3 });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 3 },
          include: expect.objectContaining({
            company: { select: { id: true, name: true, kind: true } },
          }),
        }),
      );
      expect(result.data[0].company.name).toBe('Mi Empresa');
    });
  });
});
