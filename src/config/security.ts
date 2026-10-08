import helmet from 'helmet';

/**
 * Cabeceras de seguridad HTTP globales (helmet): CSP, HSTS, X-Frame-Options,
 * nosniff... Fase 4 del PLAN_LEGAL.md. Se monta en `main.ts`; los e2e también
 * lo aplican para verificar que la configuración produce las cabeceras esperadas.
 */
export const securityHeaders = helmet();
