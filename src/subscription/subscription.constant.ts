export const FREE_PLAN_KEY = 'free';
export const TRIAL_DEFAULT_DAYS = 30;
export const SUBSCRIPTION_PERIODS = ['monthly', 'yearly'] as const;
export const SUBSCRIPTION_STATUS = ['active', 'expired'] as const;
export const PAYMENT_ORDER_STATUS = ['pending', 'paid', 'rejected'] as const;
export const PLAN_EXPIRED_CODE = 'PLAN_EXPIRED';
export const PLAN_VIEW_DENIED_CODE = 'PLAN_VIEW_DENIED';
export const TRIAL_END_WARNING_DAYS = 7;

/**
 * Vistas permitidas por plan cuando `Plan.allowedViews` no está definido.
 * Debe mantenerse sincronizado con `DEFAULT_PLAN_VIEWS` de
 * `zetta-stock-front/src/lib/permissions.ts`.
 */
export const PLAN_DEFAULT_VIEWS: Record<string, string[]> = {
  free: [
    'dashboard',
    'products',
    'clients',
    'suppliers',
    'purchases',
    'sales',
    'invoices',
    'accountsPayable',
    'accountsReceivable',
    'profile',
    'suscripcion',
  ],
  basico: [
    'dashboard',
    'caja',
    'products',
    'clients',
    'suppliers',
    'purchases',
    'sales',
    'invoices',
    'accountsPayable',
    'accountsReceivable',
    'reports',
    'users',
    'profile',
    'suscripcion',
  ],
  pro: [
    'dashboard',
    'caja',
    'products',
    'clients',
    'suppliers',
    'purchases',
    'sales',
    'invoices',
    'apartados',
    'accountsPayable',
    'accountsReceivable',
    'reports',
    'users',
    'profile',
    'suscripcion',
  ],
};
