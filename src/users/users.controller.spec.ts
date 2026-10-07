import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { ROLES_KEY } from '../auth/roles.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: ReturnType<typeof baseUsersService>;
  let reflector: Reflector;

  const baseUsersService = () => ({
    findAllUsers: jest.fn().mockResolvedValue([]),
    findSafeByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    createUser: jest.fn().mockResolvedValue({ id: 2 }),
    updateUser: jest.fn().mockResolvedValue({ id: 2 }),
    deleteUser: jest.fn().mockResolvedValue({}),
    updateProfile: jest.fn().mockResolvedValue({ id: 1, role: 'admin' }),
    updateCompany: jest.fn().mockResolvedValue({ id: 1, role: 'admin' }),
  });

  const adminReq = (overrides: any = {}) =>
    ({
      user: {
        sub: 1,
        name: 'admin',
        email: 'a@mail.com',
        companyId: 3,
        role: 'admin',
        ...overrides,
      },
    }) as any;

  beforeEach(async () => {
    usersService = baseUsersService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: {} },
        {
          provide: R2Service,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt-token') },
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

    controller = module.get<UsersController>(UsersController);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('scoping por empresa', () => {
    it('findAll limita la lista a la empresa del JWT', () => {
      controller.findAll(adminReq());

      expect(usersService.findAllUsers).toHaveBeenCalledWith(3);
    });

    it('findByEmail filtra por companyId (aislamiento entre empresas)', () => {
      controller.findByEmail('otro@mail.com', adminReq());

      expect(usersService.findSafeByEmail).toHaveBeenCalledWith(
        'otro@mail.com',
        3,
      );
    });

    it('findOne limita la búsqueda al tenant', () => {
      controller.findOne(7, adminReq());

      expect(usersService.findById).toHaveBeenCalledWith(7, 3);
    });

    it('createUser asigna la empresa del solicitante al usuario creado', () => {
      controller.createUser(
        {
          user: 'vendedor',
          email: 'v@endor.com',
          password: 'x',
          role: 'vendedor',
        } as any,
        adminReq(),
      );

      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'v@endor.com',
          role: 'vendedor',
          companyId: 3,
        }),
      );
    });

    it('updateUser pasa el actor y el companyId', () => {
      controller.updateUser(
        7,
        { user: 'vendedor', email: 'v@endor.com', role: 'admin' } as any,
        adminReq(),
      );

      expect(usersService.updateUser).toHaveBeenCalledWith(
        1,
        7,
        expect.objectContaining({ email: 'v@endor.com', role: 'admin' }),
        3,
      );
    });

    it('deleteUser pasa el actor y el companyId', () => {
      controller.deleteUser(7, adminReq());

      expect(usersService.deleteUser).toHaveBeenCalledWith(1, 7, 3);
    });

    it('el superadmin (sin companyId) no restringe por tenant', () => {
      controller.findAll(adminReq({ companyId: undefined, role: undefined }));

      expect(usersService.findAllUsers).toHaveBeenCalledWith(undefined);
    });
  });

  describe('perfil propio', () => {
    it('updateProfile reemite un token con el usuario actualizado', async () => {
      usersService.updateProfile.mockResolvedValue({ id: 1, role: 'admin' });

      const result = await controller.updateProfile(
        { name: 'Admin', currentPassword: 'x' } as any,
        adminReq(),
      );

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Admin' }),
        'x',
        3,
      );
      expect(result).toEqual({ access_token: 'jwt-token' });
    });

    it('updateMyCompany exige rol admin y usa el companyId propio', async () => {
      const result = await controller.updateMyCompany(
        { name: 'Empresa' } as any,
        adminReq(),
      );

      expect(usersService.updateCompany).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Empresa' }),
        3,
      );
      expect(result).toEqual({ access_token: 'jwt-token' });
    });
  });

  describe('roles requeridos', () => {
    const rolesOf = (handler: (...args: any[]) => any) =>
      reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler]);

    it('las rutas de gestión de usuarios exigen rol admin', () => {
      expect(rolesOf(controller.findAll)).toEqual(['admin']);
      expect(rolesOf(controller.findByEmail)).toEqual(['admin']);
      expect(rolesOf(controller.findOne)).toEqual(['admin']);
      expect(rolesOf(controller.createUser)).toEqual(['admin']);
      expect(rolesOf(controller.updateUser)).toEqual(['admin']);
      expect(rolesOf(controller.deleteUser)).toEqual(['admin']);
      expect(rolesOf(controller.updateMyCompany)).toEqual(['admin']);
    });

    it('el perfil propio no requiere rol concreto', () => {
      expect(rolesOf(controller.updateProfile)).toBeUndefined();
    });

    it('las rutas admin montan AnyAuthGuard + RolesGuard', () => {
      const guards = (handler: (...args: any[]) => any) =>
        Reflect.getMetadata('__guards__', handler) as any[];

      expect(guards(controller.findAll)).toEqual(
        expect.arrayContaining([expect.any(Function), expect.any(Function)]),
      );
      expect(guards(controller.findAll).length).toBe(2);
    });
  });
});
