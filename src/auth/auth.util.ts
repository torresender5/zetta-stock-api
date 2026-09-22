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
    planKey: user.subscription?.plan?.key ?? null,
    planName: user.subscription?.plan?.name ?? null,
    subscriptionStatus: user.subscription?.status ?? null,
    subscriptionExpiresAt: user.subscription?.expiresAt?.toISOString() ?? null,
  };
}
