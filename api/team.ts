import apiClient from "@/lib/api-client";

export type TeamMember = {
  userId: string;
  email: string;
  name: string;
  isOrgOwner: boolean;
  policies: Array<{ platform: TeamOrg["platformAccess"][number]; id: string; name: string }>;
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
      platformRoles: Array<{ platform: TeamOrg["platformAccess"][number]; roleId: string; roleName: string }>;
      cognitoStatus: string;
    }) => ({
      userId: row.user.id,
      email: row.user.email,
      name: row.user.name,
      isOrgOwner: row.user.isOrgOwner,
      policies: row.platformRoles.map(role => ({ platform: role.platform, id: role.roleId, name: role.roleName })),
      status: row.cognitoStatus === "FORCE_CHANGE_PASSWORD" ? "invite_pending" : "active",
    }));
  },
  policies: async (orgId: string): Promise<TeamPolicy[]> => {
    const { data } = await apiClient.get(`/team/${orgId}/roles`);
    return (data.roles as TeamPolicy[]).map(role => ({ ...role, memberCount: role.memberCount ?? 0 }));
  },
  invite: async (orgId: string, input: {
    email: string;
    name: string;
    assignments: Array<{ platform: TeamOrg["platformAccess"][number]; roleId: string }>;
  }) => {
    const { data } = await apiClient.post(`/team/${orgId}/users/invite`, {
      email: input.email,
      name: input.name,
    });
    await apiClient.put(`/team/${orgId}/users/${data.user.id}/roles`, {
      assignments: input.assignments,
    });
  },
  replaceAccess: (
    orgId: string,
    userId: string,
    assignments: Array<{ platform: TeamOrg["platformAccess"][number]; roleId: string }>,
  ) => apiClient.put(`/team/${orgId}/users/${userId}/roles`, { assignments }),
  removeMember: (orgId: string, userId: string) =>
    apiClient.delete(`/team/${orgId}/users/${userId}`),
  createPolicy: (orgId: string, input: { name: string; scopes: string[] }) =>
    apiClient.post(`/team/${orgId}/roles`, input),
  updatePolicy: (orgId: string, policyId: string, input: { name: string; scopes: string[] }) =>
    apiClient.patch(`/team/${orgId}/roles/${policyId}`, input),
  deletePolicy: (orgId: string, policyId: string) =>
    apiClient.delete(`/team/${orgId}/roles/${policyId}`),
};
