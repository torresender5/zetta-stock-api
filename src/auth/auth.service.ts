import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AcceptLegalDto, ConsentFlagsDto, RegisterDto } from './dto/auth.dto';
import { ConsentMeta } from 'src/users/interface/user.interface';
import { buildAuthPayload } from './auth.util';
import { MailService } from 'src/email/mail.service';
import { SUPPORT_EMAIL } from './auth.constant';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}
  // private readonly logger = new Logger(UsersController.name);

  async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compareSync(password, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hashSync(password, 10);
  }

  async signIn(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException();
    }
    const isValid = await this.verifyPassword(pass, user?.password);
    if (!isValid) {
      throw new UnauthorizedException();
    }
    if (user.active === false) {
      throw new ForbiddenException(
        'El usuario está desactivado. Contacta con el administrador.',
      );
    }
    if (user.company?.active === false) {
      throw new ForbiddenException(
        'La empresa está desactivada. Contacta con el administrador.',
      );
    }
    const payload = buildAuthPayload(user);

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  /**
   * Devuelve solo los campos públicos: el `User` completo incluye el hash de
   * la contraseña y jamás debe salir por la API (Fase 4, PLAN_LEGAL.md).
   */
  async register(
    data: RegisterDto,
    consent?: ConsentMeta,
  ): Promise<{ id: number; user: string; email: string }> {
    this.assertLegalConsent(data);
    try {
      const password = await this.hashPassword(data.password);
      const companyName =
        data.accountType === 'EMPRESA'
          ? data.companyName || data.user
          : data.user;
      const user = await this.usersService.createUserWithCompany(
        {
          user: data.user,
          email: data.email,
          password,
          companyData: {
            name: companyName,
            kind: data.accountType,
            document: data.document ?? null,
            phoneNumber: data.phoneNumber ?? null,
            address: data.address ?? null,
          },
        },
        consent,
      );
      this.logger.info(`User ${data.email} creado con company ${companyName}`);
      this.sendWelcomeEmail(data.email, data.user);
      return { id: user.id, user: user.user, email: user.email };
    } catch (error) {
      this.logger.error('Error trying to create a user', error);
      throw new BadRequestException('Error trying to create a user', {
        cause: error,
      });
    }
  }

  /**
   * Aceptación de documentos legales de un usuario que aún no los tenía
   * (subcuenta creada por el admin). Devuelve un JWT nuevo sin el flag
   * `requiresLegalAcceptance`.
   */
  async acceptLegal(
    userId: number,
    data: AcceptLegalDto,
    consent?: ConsentMeta,
  ) {
    this.assertLegalConsent(data);
    const user = await this.usersService.recordLegalAcceptance(userId, consent);
    if (!user) {
      throw new UnauthorizedException();
    }
    this.logger.info(`Usuario ${user.email} aceptó los documentos legales`);
    return {
      access_token: await this.jwtService.signAsync(buildAuthPayload(user)),
    };
  }

  /** Los tres flags son obligatorios: sin ellos no hay prueba de consentimiento. */
  private assertLegalConsent(data: ConsentFlagsDto): void {
    if (!data?.acceptTerms || !data?.acceptPrivacy || !data?.over18) {
      throw new BadRequestException(
        'Debes aceptar los Términos y Condiciones y la Política de Privacidad, y declarar tener 18 años o más.',
      );
    }
  }

  /** URL pública del front (los documentos legales viven ahí, fuente única). */
  private get webBaseUrl(): string {
    return (
      process.env.APP_BASE_URL?.trim().replace(/\/+$/, '') ||
      'https://app.zettastock.com'
    );
  }

  /**
   * Correo de bienvenida con los enlaces legales. Fire-and-forget: un fallo de
   * SMTP nunca debe impedir completar el registro. No se envía bajo test.
   */
  private sendWelcomeEmail(email: string, name: string): void {
    if (process.env.NODE_ENV === 'test') return;
    const base = this.webBaseUrl;
    void this.mailService
      .sendEmail(email, 'Bienvenido a ZettaStock', './welcome', {
        name,
        soporte: SUPPORT_EMAIL,
        appUrl: base,
        urlTerminos: `${base}/terminos`,
        urlPrivacidad: `${base}/privacidad`,
        urlReembolsos: `${base}/reembolsos`,
        urlCookies: `${base}/cookies`,
        urlAviso: `${base}/aviso-legal`,
      })
      .catch((error: unknown) =>
        this.logger.warn(
          `No se pudo enviar el correo de bienvenida a ${email}: ${String(error)}`,
        ),
      );
  }
}
