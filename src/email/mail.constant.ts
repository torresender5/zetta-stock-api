/**
 * Plantillas que se pueden enviar por correo. El `templatePath` nunca acepta
 * rutas arbitrarias: un `.hbs` ajeno permitiría leer plantillas internas
 * (Fase 4 del PLAN_LEGAL.md).
 */
export const ALLOWED_MAIL_TEMPLATES = [
  './welcome',
  './subscription_reminder',
  './subscription_expired',
] as const;

export function isAllowedMailTemplate(templatePath: string): boolean {
  return (ALLOWED_MAIL_TEMPLATES as readonly string[]).includes(templatePath);
}
