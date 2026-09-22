export interface AuthUserPayload {
  sub: number;
  name: string;
  email: string;
  role?: string;
  companyId?: number;
  companyKind?: string;
  companyName?: string;
  companyDocument?: string | null;
  companyPhoneNumber?: string | null;
  companyAddress?: string | null;
  planKey?: string | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: string | null;
}
