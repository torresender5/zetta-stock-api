import { ExecutionContext } from '@nestjs/common';

/**
 * Rutas públicas sobre las que aplica el límite de tasa: son las únicas donde
 * la fuerza bruta no exige un token previo (Fase 4 del PLAN_LEGAL.md).
 */
const THROTTLED_PATHS = new Set(['/auth/login', '/auth/register']);

/** true si la ruta de la petición está limitada por el throttler. */
export function isRateLimitedRoute(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<{ url?: string }>();
  const path = (request.url ?? '').split('?')[0];
  return THROTTLED_PATHS.has(path);
}

/** Entero positivo desde env con valor por defecto (se lee en cada request). */
export function envPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
