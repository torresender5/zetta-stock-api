import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUserPayload } from './auth-user.interface';

/**
 * Solo permite el paso al superadmin global (UserAdmin autenticado por Basic).
 * El UserAdmin no tiene companyId en el JWT/payload, a diferencia de cualquier
 * usuario de empresa que siempre lo lleva.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUserPayload }>();
    const user = request.user;
    if (!user || user.companyId) {
      throw new ForbiddenException(
        'Solo disponible para administradores globales',
      );
    }
    return true;
  }
}
