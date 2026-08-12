export const PERMISSIONS = {
  SURVEY_READ: "survey.read",
  SURVEY_CREATE: "survey.create",
  SURVEY_EDIT: "survey.edit",
  SURVEY_DELETE: "survey.delete",
  SURVEY_PUBLISH_LIVE: "survey.publish_live",
  WORKFLOW_READ: "workflow.read",
  WORKFLOW_EDIT: "workflow.edit",
  QUOTA_MANAGE: "quota.manage",
  RESPONSE_READ: "response.read",
  RESPONSE_EXPORT: "response.export",
  RESPONSE_SHARE: "response.share",
  RESPONSE_RESYNC: "response.resync",
  SURVEY_QUALITY_READ: "survey.quality.read",
  SURVEY_QUALITY_REVIEW: "survey.quality.review",
  SURVEY_QUALITY_CONFIGURE: "survey.quality.configure",
  SURVEY_QUALITY_EXPORT: "survey.quality.export",
  SURVEY_QUALITY_EXPORT_DETAILED: "survey.quality.export.detailed",
  PRIVACY_MANAGE: "privacy.manage",
  TEST_RUN: "test.run",
  USER_MANAGE_ROLES: "user.manage_roles",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

const PERMISSION_TO_SCOPE: Record<Permission, string> = {
  [PERMISSIONS.SURVEY_READ]: "survey_studio:survey.read",
  [PERMISSIONS.SURVEY_CREATE]: "survey_studio:survey.create",
  [PERMISSIONS.SURVEY_EDIT]: "survey_studio:survey.edit",
  [PERMISSIONS.SURVEY_DELETE]: "survey_studio:survey.delete",
  [PERMISSIONS.SURVEY_PUBLISH_LIVE]: "survey_studio:survey.publish",
  [PERMISSIONS.WORKFLOW_READ]: "survey_studio:survey.read",
  [PERMISSIONS.WORKFLOW_EDIT]: "survey_studio:survey.edit",
  [PERMISSIONS.QUOTA_MANAGE]: "survey_studio:quota.manage",
  [PERMISSIONS.RESPONSE_READ]: "survey_studio:response.read",
  [PERMISSIONS.RESPONSE_EXPORT]: "survey_studio:response.export",
  [PERMISSIONS.RESPONSE_SHARE]: "survey_studio:response.share",
  [PERMISSIONS.RESPONSE_RESYNC]: "survey_studio:response.read",
  [PERMISSIONS.SURVEY_QUALITY_READ]: "survey_studio:survey.quality.read",
  [PERMISSIONS.SURVEY_QUALITY_REVIEW]: "survey_studio:survey.quality.review",
  [PERMISSIONS.SURVEY_QUALITY_CONFIGURE]: "survey_studio:survey.quality.configure",
  [PERMISSIONS.SURVEY_QUALITY_EXPORT]: "survey_studio:survey.quality.export",
  [PERMISSIONS.SURVEY_QUALITY_EXPORT_DETAILED]: "survey_studio:survey.quality.export.detailed",
  [PERMISSIONS.PRIVACY_MANAGE]: "survey_studio:privacy.manage",
  [PERMISSIONS.TEST_RUN]: "survey_studio:test.run",
  [PERMISSIONS.USER_MANAGE_ROLES]: "survey_studio:ops.write",
};

export const hasPermission = (scopes: readonly string[], permission: Permission): boolean =>
  scopes.includes("*") || scopes.includes(PERMISSION_TO_SCOPE[permission]);

export const getStoredUserScopes = (): string[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("user");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      platformScopes?: unknown;
      isOrgOwner?: unknown;
      isAimAdmin?: unknown;
    };
    const scopes = Array.isArray(parsed.platformScopes)
      ? parsed.platformScopes.filter((scope): scope is string => typeof scope === "string")
      : [];
    return parsed.isOrgOwner === true || parsed.isAimAdmin === true
      ? Array.from(new Set(["*", ...scopes]))
      : scopes;
  } catch {
    return [];
  }
};
