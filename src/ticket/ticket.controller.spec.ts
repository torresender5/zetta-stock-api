import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from '../auth/roles.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('TicketController', () => {
  let controller: TicketController;
  let reflector: Reflector;
  let ticketService: {
    findAll: jest.Mock;
    create: jest.Mock;
    getDetail: jest.Mock;
    addCompanyMessage: jest.Mock;
    updateCompanyStatus: jest.Mock;
  };

  const adminReq = (overrides: any = {}) =>
    ({
      user: {
        sub: 7,
        name: 'Ana Admin',
        email: 'ana@mail.com',
        companyId: 3,
        role: 'admin',
        ...overrides,
      },
    }) as any;

  beforeEach(async () => {
    ticketService = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      getDetail: jest.fn().mockResolvedValue({ id: 1 }),
      addCompanyMessage: jest.fn().mockResolvedValue({ id: 1 }),
      updateCompanyStatus: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [
        { provide: TicketService, useValue: ticketService },
        { provide: PrismaService, useValue: {} },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn().mockResolvedValue(null) },
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

    controller = module.get<TicketController>(TicketController);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('roles requeridos', () => {
    const rolesOf = (handler: (...args: any[]) => any) =>
      reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler]);

    it('todas las rutas de tickets exigen rol admin (Administrador)', () => {
      expect(rolesOf(controller.findAll)).toEqual(['admin']);
      expect(rolesOf(controller.create)).toEqual(['admin']);
      expect(rolesOf(controller.findOne)).toEqual(['admin']);
      expect(rolesOf(controller.addMessage)).toEqual(['admin']);
      expect(rolesOf(controller.updateStatus)).toEqual(['admin']);
    });
  });

  describe('aislamiento de empresa', () => {
    it('findAll pasa el companyId del JWT al servicio', () => {
      controller.findAll({}, adminReq());

      expect(ticketService.findAll).toHaveBeenCalledWith({}, 3);
    });

    it('rechaza el superadmin (Basic sin companyId) en las rutas de empresa', () => {
      expect(() =>
        controller.findAll({}, adminReq({ companyId: undefined })),
      ).toThrow(ForbiddenException);
      expect(ticketService.findAll).not.toHaveBeenCalled();
    });

    it('create entrega el usuario completo para el mensaje inicial', () => {
      controller.create(
        { subject: 'Asunto', category: 'falla', body: 'Detalle' },
        adminReq(),
      );

      expect(ticketService.create).toHaveBeenCalledWith(
        { subject: 'Asunto', category: 'falla', body: 'Detalle' },
        expect.objectContaining({ sub: 7, companyId: 3 }),
        undefined,
      );
    });

    it('addMessage exige companyId antes de responder', () => {
      expect(() =>
        controller.addMessage(
          1,
          { body: 'Hola' },
          adminReq({ companyId: undefined }),
        ),
      ).toThrow(ForbiddenException);
      expect(ticketService.addCompanyMessage).not.toHaveBeenCalled();
    });
  });
});
