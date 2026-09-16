import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { jwtConstants } from './auth.constant';
import bcrypt from 'bcryptjs';

/**
 * Acepta autenticacion JWT (Authorization: Bearer <token>)
 * o Basic Auth contra la tabla UserAdmin (Authorization: Basic base64(email:password)).
 * Funciona con uno u otro metodo, nunca exige ambos.
 */
@Injectable()
export class AnyAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return this.validateJwt(token, request);
    }
    if (type === 'Basic' && token) {
      return this.validateBasic(token, request);
    }
    throw new UnauthorizedException();
  }

  private async validateJwt(token: string, request: any): Promise<boolean> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
      request['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async validateBasic(encoded: string, request: any): Promise<boolean> {
    const credentials = this.decodeCredentials(encoded);
    if (!credentials) {
      throw new UnauthorizedException();
    }
    const admin = await this.prisma.userAdmin.findUnique({
      where: { email: credentials.email },
    });
    if (!admin || !bcrypt.compareSync(credentials.password, admin.password)) {
      throw new UnauthorizedException();
    }
    request['user'] = { sub: admin.id, name: admin.user, email: admin.email };
    return true;
  }

  private decodeCredentials(
    encoded: string,
  ): { email: string; password: string } | null {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex === -1) {
        return null;
      }
      return {
        email: decoded.slice(0, separatorIndex),
        password: decoded.slice(separatorIndex + 1),
      };
    } catch {
      return null;
    }
  }
}
