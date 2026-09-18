import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { MailService } from '../email/mail.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RegisterDto } from './dto/auth.dto';
import { buildAuthPayload } from './auth.util';

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
    const payload = buildAuthPayload(user);
    this.logger.debug(payload);
    await this.mailService.sendUserConfirmation(user, 'Hola');

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(data: RegisterDto) {
    try {
      this.logger.debug(data);
      const password = await this.hashPassword(data.password);
      const companyName =
        data.accountType === 'EMPRESA'
          ? data.companyName || data.user
          : data.user;
      const user = await this.usersService.createUserWithCompany({
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
      });
      this.logger.info(`User ${data.email} creado con company ${companyName}`);
      return user;
    } catch (error) {
      this.logger.error('Error trying to create a user', error);
      throw new BadRequestException('Error trying to create a user', {
        cause: error,
      });
    }
  }
}
