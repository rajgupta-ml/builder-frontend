import apiClient from "@/lib/api-client";
import { LoginCredentials, LoginResponse, User } from "@/types/auth";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  role: z.enum(["SUPER_ADMIN", "PROJECT_MANAGER", "SALES_REP", "DEMO_USER"]),
  roleExpiresAt: z.string().nullable().optional(),
});

const meSchema = z.object({
  user: userSchema,
});

export const authApi = {
  //Done
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/auth/login", credentials);
    const parsed = z
      .object({
        token: z.string(),
        user: userSchema,
      })
      .safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid login response shape",
        details: { endpoint: "/auth/login" },
      });
      throw new Error("Invalid login payload");
    }
    return parsed.data as LoginResponse;
  },
  //Done
  me: async (): Promise<{ user: User }> => {
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

  updateMe: async (payload: { name: string }): Promise<{ user: User; message: string }> => {
    const response = await apiClient.patch("/auth/me", payload);
    const parsed = z.object({
      message: z.string(),
      user: userSchema,
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

  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    const response = await apiClient.patch("/auth/me/password", payload);
    const parsed = z.object({ message: z.string() }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid change password response shape",
        details: { endpoint: "/auth/me/password" },
      });
      throw new Error("Invalid change password payload");
    }
    return parsed.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await apiClient.post("/auth/logout");
    const parsed = z.object({ message: z.string() }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid logout response shape",
        details: { endpoint: "/auth/logout" },
      });
      throw new Error("Invalid logout payload");
    }
    return parsed.data;
  },
};
