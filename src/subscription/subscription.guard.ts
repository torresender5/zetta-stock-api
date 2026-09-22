import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUserPayload } from 'src/auth/auth-user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { PLAN_EXPIRED_CODE } from './subscription.constant';

/**
 * Bloquea a las empresas cuya suscripción (o prueba gratuita) ya venció.
 * Registrado como APP_GUARD: se ejecuta sobre todas las rutas, salvo las que
 * deben quedar accesibles para que el usuario renueve (auth, /plans,
 * /subscription, perfil) y el superadmin (UserAdmin sin companyId).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  private isExemptPath(path: string): boolean {
    const normalized = path.toLowerCase();
    return (
      normalized.startsWith('/auth') ||
      normalized.startsWith('/plans') ||
      normalized.startsWith('/subscription') ||
      normalized.startsWith('/users/me') ||
      normalized.startsWith('/mail')
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUserPayload; path: string }>();

    // Rutas públicas o usuario anónimo: lo resuelven sus propios guards.
    if (!request.user) {
      return true;
    }
    // Superadmin (UserAdmin por Basic): sin companyId, siempre permitido.
    if (!request.user.companyId) {
      return true;
    }
    // Rutas necesarias para renovar / ver el perfil.
    if (this.isExemptPath(request.path)) {
      return true;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId: request.user.companyId },
    });
    // Empresas heredadas sin suscripción no se bloquean.
    if (!subscription) {
      return true;
    }
    const effectiveEnd = subscription.trialEndsAt ?? subscription.expiresAt;
    const expired =
      subscription.status === 'expired' ||
      (effectiveEnd !== null && effectiveEnd.getTime() <= Date.now());

    if (expired) {
      throw new ForbiddenException({
        message:
          'Tu plan ha vencido. Activa tu suscripción para continuar usando ZettaStock.',
        code: PLAN_EXPIRED_CODE,
      });
    }
    return true;
  }
}
