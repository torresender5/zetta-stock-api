import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Inject,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateLoginDto, RegisterDto } from './dto/auth.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: CreateLoginDto) {
    this.logger.info('Starting signIn function');
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  @HttpCode(HttpStatus.OK)
  @Post('register')
  register(@Body() signInDto: RegisterDto) {
    console.log('Register DTO:', signInDto);
    this.logger.info('Starting register function');
    console.log('Register DTO:', signInDto);
    return this.authService.register(signInDto);
  }
}
// curl -X POST http://localhost:3000/auth/login -d '{"email": "torresender5@gmail.coom", "password": "test123"}' -H "Content-Type: application/json"
