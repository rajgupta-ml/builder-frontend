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
