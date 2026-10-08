import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUserPayload } from 'src/auth/auth-user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  FREE_PLAN_KEY,
  PLAN_DEFAULT_VIEWS,
  PLAN_EXPIRED_CODE,
  PLAN_VIEW_DENIED_CODE,
} from './subscription.constant';

/**
 * Prefijo de ruta → vista (ViewKey) que el plan debe incluir.
 * Orden importa: los prefijos más específicos van primero.
 * Debe mantenerse al día con las rutas de los controllers.
 */
const PATH_VIEWS: ReadonlyArray<readonly [prefix: string, view: string]> = [
  ['/reports/accounts-receivable', 'accountsReceivable'],
  ['/reports/accounts-payable', 'accountsPayable'],
  ['/reports/apartados', 'apartados'],
  ['/reports', 'reports'],
  ['/dashboard', 'dashboard'],
  ['/products', 'products'],
  ['/categories', 'products'],
  ['/client', 'clients'],
  ['/suppliers', 'suppliers'],
  ['/purchases', 'purchases'],
  ['/sales', 'sales'],
  ['/invoices', 'invoices'],
  ['/apartados', 'apartados'],
  ['/cash-registers', 'caja'],
  ['/users', 'users'],
];

/**
 * Bloquea a las empresas cuya suscripción (o prueba gratuita) ya venció y
 * valida que la vista (módulo) requerida por la ruta esté incluida en el plan
 * (`Plan.allowedViews`, con los mismos defaults que el frontend).
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
      normalized.startsWith('/notifications') ||
      normalized.startsWith('/webhooks') ||
      // Derechos ARCO: siempre ejercibles, con plan vencido o sin módulo 'users'.
      normalized.startsWith('/data-subject-request') ||
      // Soporte: siempre accesible (reportar fallas o pagar con plan vencido).
      normalized.startsWith('/tickets') ||
      normalized.startsWith('/users/me')
    );
  }

  private requiredViewFor(path: string): string | null {
    const normalized = path.toLowerCase();
    for (const [prefix, view] of PATH_VIEWS) {
      if (normalized.startsWith(prefix)) {
        return view;
      }
    }
    return null;
  }

  private allowedViewsFor(
    plan: { key: string; allowedViews?: unknown } | null | undefined,
  ): string[] {
    const views = plan?.allowedViews;
    if (Array.isArray(views) && views.length > 0) {
      return views as string[];
    }
    const planKey = plan?.key ?? FREE_PLAN_KEY;
    return PLAN_DEFAULT_VIEWS[planKey] ?? PLAN_DEFAULT_VIEWS[FREE_PLAN_KEY];
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
      include: { plan: true },
    });
    // Empresas heredadas sin suscripción no se bloquean por vencimiento,
    // pero sí se les aplican las vistas del plan gratuito por defecto.
    if (subscription) {
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
    }

    const requiredView = this.requiredViewFor(request.path);
    if (requiredView) {
      const allowedViews = this.allowedViewsFor(subscription?.plan);
      if (!allowedViews.includes(requiredView)) {
        throw new ForbiddenException({
          message:
            'Tu plan actual no incluye este módulo. Actualiza tu plan para acceder.',
          code: PLAN_VIEW_DENIED_CODE,
        });
      }
    }
    return true;
  }
}
