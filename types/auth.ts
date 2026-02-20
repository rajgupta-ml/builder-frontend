export type UserRole = "SUPER_ADMIN" | "PROJECT_MANAGER" | "SALES_REP" | "DEMO_USER";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  roleExpiresAt?: string | null;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}
