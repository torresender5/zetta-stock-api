export interface UserCompany {
  id: number;
  name: string;
  kind: string;
  document: string | null;
  phoneNumber: string | null;
  address: string | null;
  active: boolean;
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
