export type AimUser = {
  userId: string;
  email: string;
  name: string;
  orgId: string | null;
  isOrgOwner: boolean;
  isAimAdmin: boolean;
  platformScopes: string[];
};

export interface LoginCredentials {
  email: string;
  password: string;
}

// Legacy role type kept for UI permission gates (permissions.ts, EditorHeader, metrics page).
// Not used for auth — scopes come from AimUser.platformScopes.
export type UserRole = "SUPER_ADMIN" | "PROJECT_MANAGER" | "SALES_REP" | "DEMO_USER";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  roleExpiresAt?: string | null;
}
