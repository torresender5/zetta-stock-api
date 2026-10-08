import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../email/mail.service';
import { JwtService } from '@nestjs/jwt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RegisterDto } from './dto/auth.dto';

describe('AuthService', () => {
  let service: AuthService;
  let logger: Record<'info' | 'error' | 'warn' | 'debug', jest.Mock>;

  /** Llamadas capturadas como unknown[] para poder serializarlas en aserciones. */
  const callsOf = (mock: jest.Mock): unknown[][] =>
    mock.mock.calls as unknown[][];

  const usersService = {
    createUserWithCompany: jest.fn(),
    recordLegalAcceptance: jest.fn(),
    findByEmail: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-token'),
  };
  const mailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const baseRegister: RegisterDto = {
    user: 'Ana Pérez',
    email: 'ana@test.local',
    password: 'secret123',
    accountType: 'PERSONA',
    acceptTerms: true,
    acceptPrivacy: true,
    over18: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register — consentimiento legal', () => {
    it('crea la cuenta con los tres flags en true y guarda la meta de consentimiento', async () => {
      usersService.createUserWithCompany.mockResolvedValue({
        id: 7,
        user: 'Ana Pérez',
        email: 'ana@test.local',
        password: '$2a$10$hashsecreto',
      });

      const result = await service.register(baseRegister, {
        ip: '200.10.10.10',
        userAgent: 'jest-agent',
      });

      expect(result).toEqual({
        id: 7,
        user: 'Ana Pérez',
        email: 'ana@test.local',
      });
      expect(result).not.toHaveProperty('password');
      expect(usersService.createUserWithCompany).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@test.local' }),
        { ip: '200.10.10.10', userAgent: 'jest-agent' },
      );
    });

    it('no vuelca la contraseña ni los datos del registro en los logs (Fase 4)', async () => {
      usersService.createUserWithCompany.mockResolvedValue({
        id: 7,
        user: 'Ana Pérez',
        email: 'ana@test.local',
        password: '$2a$10$hashsecreto',
      });

      await service.register(baseRegister);

      expect(logger.debug).not.toHaveBeenCalled();
      const logged = JSON.stringify([
        ...callsOf(logger.info),
        ...callsOf(logger.warn),
        ...callsOf(logger.error),
      ]);
      expect(logged).not.toContain(baseRegister.password);
      expect(logged).not.toContain('$2a$10$hashsecreto');
    });

    it.each(['acceptTerms', 'acceptPrivacy', 'over18'] as const)(
      'rechaza el registro sin %s → 400',
      async (flag) => {
        const payload = { ...baseRegister, [flag]: false };

        await expect(service.register(payload)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(usersService.createUserWithCompany).not.toHaveBeenCalled();
      },
    );

    it('rechaza el registro cuando los flags no vienen (undefined) → 400', async () => {
      const payload = { ...baseRegister } as Record<string, unknown>;
      delete payload.acceptTerms;
      delete payload.acceptPrivacy;
      delete payload.over18;

      await expect(
        service.register(payload as unknown as RegisterDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.createUserWithCompany).not.toHaveBeenCalled();
    });

    it('envía el correo de bienvenida con los enlaces legales', async () => {
      usersService.createUserWithCompany.mockResolvedValue({ id: 7 });
      const nodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      try {
        await service.register(baseRegister, { ip: '200.10.10.10' });
      } finally {
        if (nodeEnv !== undefined) process.env.NODE_ENV = nodeEnv;
      }

      expect(mailService.sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, template, context] = mailService.sendEmail.mock
        .calls[0] as [string, string, string, Record<string, string>];
      expect(to).toBe('ana@test.local');
      expect(subject).toBe('Bienvenido a ZettaStock');
      expect(template).toBe('./welcome');
      expect(context.urlTerminos).toContain('/terminos');
      expect(context.urlPrivacidad).toContain('/privacidad');
      expect(context.urlReembolsos).toContain('/reembolsos');
    });
  });

  describe('acceptLegal — primer login sin consentimiento', () => {
    it('registra la aceptación y devuelve un JWT nuevo', async () => {
      usersService.recordLegalAcceptance.mockResolvedValue({
        id: 3,
        user: 'Subcuenta',
        email: 'sub@test.local',
        role: 'vendedor',
        acceptedTerms: true,
        company: { id: 9, name: 'Negocio', kind: 'PERSONA' },
      });

      const result = await service.acceptLegal(3, baseRegister, {
        ip: '200.10.10.10',
        userAgent: 'jest-agent',
      });

      expect(usersService.recordLegalAcceptance).toHaveBeenCalledWith(3, {
        ip: '200.10.10.10',
        userAgent: 'jest-agent',
      });
      expect(result.access_token).toBe('jwt-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 3, requiresLegalAcceptance: false }),
      );
    });

    it('rechaza la aceptación sin los tres flags → 400', async () => {
      await expect(
        service.acceptLegal(3, { ...baseRegister, over18: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.recordLegalAcceptance).not.toHaveBeenCalled();
    });

    it('devuelve 401 si el usuario no existe en la tabla User', async () => {
      usersService.recordLegalAcceptance.mockResolvedValue(null);

      await expect(
        service.acceptLegal(999, baseRegister),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signIn — flag requiresLegalAcceptance', () => {
    const user = (acceptedTerms: boolean) => ({
      id: 1,
      user: 'Ana',
      email: 'ana@test.local',
      password: bcrypt.hashSync('secret123', 4),
      role: 'admin',
      active: true,
      companyId: 5,
      acceptedTerms,
    });

    it('marca requiresLegalAcceptance cuando el usuario no aceptó nada', async () => {
      usersService.findByEmail.mockResolvedValue(user(false));

      await service.signIn('ana@test.local', 'secret123');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ requiresLegalAcceptance: true }),
      );
    });

    it('no lo marca cuando acceptedTerms ya está en true', async () => {
      usersService.findByEmail.mockResolvedValue(user(true));

      await service.signIn('ana@test.local', 'secret123');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ requiresLegalAcceptance: false }),
      );
    });

    it('no escribe el payload JWT ni la contraseña en los logs (Fase 4)', async () => {
      usersService.findByEmail.mockResolvedValue(user(true));

      await service.signIn('ana@test.local', 'secret123');

      expect(logger.debug).not.toHaveBeenCalled();
      const logged = JSON.stringify([
        ...callsOf(logger.info),
        ...callsOf(logger.warn),
        ...callsOf(logger.error),
      ]);
      expect(logged).not.toContain('secret123');
    });
  });
});
