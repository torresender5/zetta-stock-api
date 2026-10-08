import { Users } from 'src/users/interface/user.interface';
import { AuthUserPayload } from './auth-user.interface';

export function buildAuthPayload(user: Users): AuthUserPayload {
  return {
    sub: user.id,
    name: user.user,
    email: user.email,
    role: user.role,
    companyId: user.company?.id,
    companyKind: user.company?.kind,
    companyName: user.company?.name,
    companyDocument: user.company?.document ?? null,
    companyPhoneNumber: user.company?.phoneNumber ?? null,
    companyAddress: user.company?.address ?? null,
    companyCurrency: user.company?.currency ?? 'USD',
    companyTaxRate: user.company?.taxRate ?? 19,
    planKey: user.subscription?.plan?.key ?? null,
    planName: user.subscription?.plan?.name ?? null,
    subscriptionStatus: user.subscription?.status ?? null,
    subscriptionExpiresAt: user.subscription?.expiresAt?.toISOString() ?? null,
    // Fase 1 (PLAN_LEGAL.md): sin aceptación registrada, el cliente debe
    // mostrar el modal de aceptación legal antes de usar la aplicación.
    requiresLegalAcceptance: user.acceptedTerms !== true,
  };
}
