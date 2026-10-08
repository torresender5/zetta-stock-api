import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AcceptLegalDto, CreateLoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { Auth } from './auth.decorator';
import { AuthUserPayload } from './auth-user.interface';
import { ConsentMeta } from 'src/users/interface/user.interface';
import type { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/** IP y agente que prueban el consentimiento legal (Ley OPDP 1733). */
type RequestWithConsent = Request & { user?: AuthUserPayload };

function consentMeta(req: RequestWithConsent): ConsentMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: CreateLoginDto) {
    this.logger.info('Starting signIn function');
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('register')
  register(@Body() signInDto: RegisterDto, @Req() req: RequestWithConsent) {
    this.logger.info('Starting register function');
    return this.authService.register(signInDto, consentMeta(req));
  }

  /**
   * Aceptación forzada de los documentos legales en el primer login
   * (subcuentas creadas por un admin sin consentimiento registrado).
   * La ruta NO es pública: exige el JWT del usuario que acepta.
   */
  @HttpCode(HttpStatus.OK)
  @Auth()
  @Post('accept-legal')
  acceptLegal(
    @Body() acceptLegalDto: AcceptLegalDto,
    @Req() req: RequestWithConsent,
  ) {
    this.logger.info('Starting acceptLegal function');
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.authService.acceptLegal(
      userId,
      acceptLegalDto,
      consentMeta(req),
    );
  }
}
// curl -X POST http://localhost:3000/auth/login -d '{"email": "torresender5@gmail.coom", "password": "test123"}' -H "Content-Type: application/json"
