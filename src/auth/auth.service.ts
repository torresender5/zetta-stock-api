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
    console.log(user);

    if (!user) {
      throw new UnauthorizedException();
    }
    const isValid = await this.verifyPassword(pass, user?.password);
    console.log(isValid);
    if (!isValid) {
      throw new UnauthorizedException();
    }
    const payload = { sub: user.id, name: user.user, email: user.email };
    this.logger.debug(payload);
    await this.mailService.sendUserConfirmation(user, 'Hola');

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  async register(data: any) {
    try {
      this.logger.debug(data);
      data['password'] = await this.hashPassword(data.password);
      this.logger.debug(data);
      const user = await this.usersService.createUser(data);
    } catch (error) {
      throw new BadRequestException('Error trying to create a user', {
        cause: new Error(),
        description: 'Error trying to create a user',
      });
    }
  }
}
