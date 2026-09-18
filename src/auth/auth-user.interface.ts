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
}
