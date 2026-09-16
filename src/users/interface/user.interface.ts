export interface Users {
  id: number;
  user: string;
  email: string;
  password: string;
  // createdAt DateTime @default(now())
}

export interface User {
  email: string;
  user: string;
}
