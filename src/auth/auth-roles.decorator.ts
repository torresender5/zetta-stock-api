import { applyDecorators, UseGuards } from '@nestjs/common';
import { AnyAuthGuard } from './any-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

/**
 * Acepta JWT o Basic (UserAdmin) y valida el rol del usuario contra los
 * roles indicados. El UserAdmin (sin rol) siempre tiene acceso.
 */
export const AuthRoles = (...roles: string[]) =>
  applyDecorators(UseGuards(AnyAuthGuard, RolesGuard), Roles(...roles));
