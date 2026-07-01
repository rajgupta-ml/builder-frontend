import apiClient from "@/lib/api-client";

export type TeamMember = {
  userId: string;
  email: string;
  name: string;
  isOrgOwner: boolean;
  policies: Array<{ id: string; name: string }>;
  status: "active" | "invite_pending";
};

export type TeamPolicy = {
  id: string;
  name: string;
  scopes: string[];
  memberCount: number;
};

export type TeamOrg = {
  id: string;
  name: string;
  platformAccess: Array<"gle" | "survey_studio" | "data_analysis">;
};

const scopePlatform = (scope: string): "gle" | "survey_studio" | "data_analysis" | null => {
  const prefix = scope.split(":")[0];
  if (prefix === "gle") return "gle";
  if (prefix === "survey_studio") return "survey_studio";
  if (prefix === "da") return "data_analysis";
  return null;
};

export const teamApi = {
  org: async (orgId: string): Promise<TeamOrg> => {
    const { data } = await apiClient.get(`/team/${orgId}`);
    return {
      id: data.org.id,
      name: data.org.name,
      platformAccess: data.platforms.map((item: { platform: TeamOrg["platformAccess"][number] }) => item.platform),
    };
  },
  members: async (orgId: string): Promise<TeamMember[]> => {
    const { data } = await apiClient.get(`/team/${orgId}/users`);
    return data.users.map((row: {
      user: { id: string; email: string; name: string; isOrgOwner: boolean };
      platformRoles: Array<{ roleId: string; roleName: string }>;
      cognitoStatus: string;
    }) => ({
      userId: row.user.id,
      email: row.user.email,
      name: row.user.name,
      isOrgOwner: row.user.isOrgOwner,
      policies: row.platformRoles.map(role => ({ id: role.roleId, name: role.roleName })),
      status: row.cognitoStatus === "FORCE_CHANGE_PASSWORD" ? "invite_pending" : "active",
    }));
  },
  policies: async (orgId: string): Promise<TeamPolicy[]> => {
    const { data } = await apiClient.get(`/team/${orgId}/roles`);
    return (data.roles as TeamPolicy[]).map(role => ({ ...role, memberCount: role.memberCount ?? 0 }));
  },
  invite: async (orgId: string, input: { email: string; name: string; policyIds: string[]; policies: TeamPolicy[] }) => {
    const { data } = await apiClient.post(`/team/${orgId}/users/invite`, {
      email: input.email,
      name: input.name,
    });
    for (const roleId of input.policyIds) {
      const policy = input.policies.find(item => item.id === roleId);
      const platforms = new Set((policy?.scopes ?? []).map(scopePlatform).filter(
        (platform): platform is "gle" | "survey_studio" | "data_analysis" => platform !== null,
      ));
      for (const platform of platforms) {
        await apiClient.post(`/team/${orgId}/users/roles`, {
          userId: data.user.id,
          platform,
          roleId,
        });
      }
    }
  },
  removeMember: (orgId: string, userId: string) =>
    apiClient.delete(`/team/${orgId}/users/${userId}`),
  createPolicy: (orgId: string, input: { name: string; scopes: string[] }) =>
    apiClient.post(`/team/${orgId}/roles`, input),
  updatePolicy: (orgId: string, policyId: string, input: { name: string; scopes: string[] }) =>
    apiClient.patch(`/team/${orgId}/roles/${policyId}`, input),
  deletePolicy: (orgId: string, policyId: string) =>
    apiClient.delete(`/team/${orgId}/roles/${policyId}`),
};
