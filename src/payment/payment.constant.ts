/** Proveedores de pago soportados para suscripciones. */
export const PAYMENT_PROVIDERS = ['stripe', 'pabilo', 'manual'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** Firma de webhook de Stripe (header `stripe-signature`). */
export const STRIPE_SIGNATURE_HEADER = 'stripe-signature';

/** Cabeceras de firma de webhook de Pabilo (HMAC-SHA256). */
export const PABILO_TIMESTAMP_HEADER = 'x-pabilo-timestamp';
export const PABILO_SIGNATURE_HEADER = 'x-pabilo-signature';

/** Ventana máxima de antigüedad (segundos) aceptada en webhooks de Pabilo. */
export const PABILO_SIGNATURE_MAX_AGE_SECONDS = 300;

/** API pública de Pabilo. */
export const PABILO_API_BASE = 'https://api.pabilo.app';

/** Vigencia por defecto (minutos) de un link de pago de Pabilo. */
export const PABILO_LINK_EXPIRATION_MINUTES = 1440;
