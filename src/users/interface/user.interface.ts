export interface UserCompany {
  id: number;
  name: string;
  kind: string;
  document: string | null;
  phoneNumber: string | null;
  address: string | null;
}

export interface Users {
  id: number;
  user: string;
  email: string;
  password: string;
  role: string;
  companyId: number | null;
  company?: UserCompany | null;
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
