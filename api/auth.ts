import apiClient from "@/lib/api-client";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

export type AimUser = {
  userId: string;
  email: string;
  name: string;
  orgId: string | null;
  isOrgOwner: boolean;
  isAimAdmin: boolean;
  platformScopes: string[];
};

const aimUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  orgId: z.string().nullable(),
  isOrgOwner: z.boolean(),
  isAimAdmin: z.boolean(),
  platformScopes: z.array(z.string()),
});

const meSchema = z.object({ user: aimUserSchema });

export const authApi = {
  me: async (): Promise<{ user: AimUser }> => {
    const response = await apiClient.get("/auth/me");
    const parsed = meSchema.safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid me response shape",
        details: { endpoint: "/auth/me" },
      });
      throw new Error("Invalid auth payload");
    }
    return parsed.data;
  },

  updateMe: async (payload: { name: string }): Promise<{ user: AimUser; message: string }> => {
    const response = await apiClient.patch("/auth/me", payload);
    const parsed = z.object({
      message: z.string(),
      user: aimUserSchema,
    }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid update profile response shape",
        details: { endpoint: "/auth/me" },
      });
      throw new Error("Invalid update profile payload");
    }
    return parsed.data;
  },
};
