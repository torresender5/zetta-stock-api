/**
 * Versión de los documentos legales (Términos y Política de Privacidad)
 * aceptados por el usuario. Debe coincidir con LEGAL_VERSION del front
 * (zetta-stock-front/src/pages/legal/legalConfig.ts).
 */
export const LEGAL_TERMS_VERSION = '1.0';

/** Canal de soporte/contacto legal (en espejo con front, app y Aviso Legal). */
export const SUPPORT_EMAIL = 'soporte@zettastock.com';

export const jwtConstants = {
  /**
   * Se lee en cada uso para que esté disponible tras cargar .env.
   * Sin secreto no hay arranque: un valor por defecto (Fase 4) permitiría
   * firmar tokens cualquiera.
   */
  get secret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      throw new Error(
        'Falta JWT_SECRET: define el secreto de firma en .env (openssl rand -hex 32).',
      );
    }
    return secret;
  },
};
