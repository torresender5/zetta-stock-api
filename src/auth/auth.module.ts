import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/email/mail.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './auth.constant';

@Module({
  imports: [
    UsersModule,
    // @Auth() sobre /auth/accept-legal instancia AnyAuthGuard en este módulo.
    PrismaModule,
    // Correo de bienvenida con los enlaces legales (Fase 2 del PLAN_LEGAL.md).
    MailModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1D' },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
