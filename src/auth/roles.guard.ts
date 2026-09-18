import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AuthUserPayload } from './auth-user.interface';

/**
 * Valida que el rol del usuario autenticado este entre los roles del
 * decorador @Roles(). El UserAdmin (superadmin global por Basic auth)
 * no tiene rol ni companyId, por lo que se le permite el acceso.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUserPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Acceso restringido');
    }
    if (!user.role) {
      return true;
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }
    return true;
  }
}
