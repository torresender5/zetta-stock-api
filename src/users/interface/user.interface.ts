export interface UserCompany {
  id: number;
  name: string;
  kind: string;
  document: string | null;
  phoneNumber: string | null;
  address: string | null;
  active: boolean;
  currency?: string;
  taxRate?: number;
}

export interface UserSubscriptionPlan {
  key: string;
  name: string;
}

export interface UserSubscription {
  status: string;
  period: string;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  plan?: UserSubscriptionPlan | null;
}

export interface Users {
  id: number;
  user: string;
  email: string;
  password: string;
  role: string;
  active: boolean;
  companyId: number | null;
  company?: UserCompany | null;
  subscription?: UserSubscription | null;
  /** Aceptó los documentos legales (Ley OPDP 1733). Ausente en usuarios antiguos. */
  acceptedTerms?: boolean;
  termsVersion?: string | null;
  acceptedAt?: Date | null;
  // createdAt DateTime @default(now())
}

export interface User {
  email: string;
  user: string;
}

export interface SafeUser {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number | null;
  createdAt: Date;
}

/** Datos de la petición que prueban el consentimiento legal (Ley OPDP 1733). */
export interface ConsentMeta {
  ip?: string | null;
  userAgent?: string | null;
}
