import apiClient from "@/lib/api-client";
import { LoginCredentials, LoginResponse } from "@/types/auth";

export const authApi = {
  //Done
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/auth/login", credentials);
    return response.data;
  },
  //Done
  me: async (): Promise<any> => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  }
};
