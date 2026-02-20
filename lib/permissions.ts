import type { UserRole } from "@/types/auth";

export const PERMISSIONS = {
  SURVEY_CREATE: "survey.create",
  SURVEY_EDIT: "survey.edit",
  SURVEY_DELETE: "survey.delete",
  SURVEY_PUBLISH_LIVE: "survey.publish_live",
  WORKFLOW_READ: "workflow.read",
  WORKFLOW_EDIT: "workflow.edit",
  QUOTA_MANAGE: "quota.manage",
  RESPONSE_READ: "response.read",
  RESPONSE_EXPORT: "response.export",
  RESPONSE_RESYNC: "response.resync",
  PRIVACY_MANAGE: "privacy.manage",
  TEST_RUN: "test.run",
  USER_MANAGE_ROLES: "user.manage_roles",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const rolePermissions: Record<UserRole, Set<Permission>> = {
  SUPER_ADMIN: new Set(ALL_PERMISSIONS),
  PROJECT_MANAGER: new Set(ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.USER_MANAGE_ROLES)),
  SALES_REP: new Set([
    PERMISSIONS.SURVEY_CREATE,
    PERMISSIONS.SURVEY_EDIT,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_EDIT,
    PERMISSIONS.QUOTA_MANAGE,
    PERMISSIONS.RESPONSE_READ,
    PERMISSIONS.TEST_RUN,
  ]),
  DEMO_USER: new Set([
    PERMISSIONS.SURVEY_CREATE,
    PERMISSIONS.SURVEY_EDIT,
    PERMISSIONS.WORKFLOW_READ,
    PERMISSIONS.WORKFLOW_EDIT,
    PERMISSIONS.QUOTA_MANAGE,
    PERMISSIONS.RESPONSE_READ,
  ]),
};

export const hasPermission = (role: UserRole | undefined, permission: Permission) => {
  if (!role) return false;
  return rolePermissions[role]?.has(permission) ?? false;
};

export const getStoredUserRole = (): UserRole | undefined => {
  if (typeof window === "undefined") return undefined;
  const raw = localStorage.getItem("user");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { role?: UserRole; roleExpiresAt?: string | null };
    if (!parsed.role) return undefined;
    if (parsed.roleExpiresAt && new Date(parsed.roleExpiresAt).getTime() < Date.now()) {
      return undefined;
    }
    return parsed.role;
  } catch {
    return undefined;
  }
};
