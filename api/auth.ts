import apiClient from "@/lib/api-client";
import { LoginCredentials, LoginResponse } from "@/types/auth";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

export const authApi = {
  //Done
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/auth/login", credentials);
    const parsed = z
      .object({
        token: z.string(),
        user: z.unknown(),
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
  me: async (): Promise<any> => {
    const response = await apiClient.get("/auth/me");
    const parsed = z.unknown().safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid me response shape",
        details: { endpoint: "/auth/me" },
      });
      throw new Error("Invalid auth payload");
    }
    return parsed.data;
  }
};
