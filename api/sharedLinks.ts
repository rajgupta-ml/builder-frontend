import apiClient from "@/lib/api-client";

export type SharedExportFormat = "csv" | "xlsx" | "spss" | "json";
export type SharedExportMode = "LIVE" | "TEST";

export type SharedLinkResponse = {
  shareUrl?: string;
  url?: string;
  token?: string;
  emailSent?: boolean;
  emailError?: string | null;
};

export type SharedExportMeta = {
  format: SharedExportFormat;
  mode: SharedExportMode;
  expiresAt: string;
  status?: string;
};

export type SharedDashboardMeta = {
  mode: "LIVE";
  expiryPolicy: string;
  status: string;
  expiresAt?: string | null;
};

export type SharedDashboardPayload = {
  survey: {
    id: string;
    name: string;
    status: string;
    client?: string | null;
    updatedAt?: string;
  };
  mode: "LIVE";
  metrics: {
    views: number;
    starts: number;
    completes: number;
    overQuota: number;
    disqualified: number;
    dropped: number;
    securityTerminate: number;
    ir: number;
    avgTime: number;
    updatedAt?: string;
  };
  quotas: Array<{
    quotaId: string;
    quotaName: string;
    currentCount: number;
    targetCount: number;
    fillRate: number;
    isFull: boolean;
    updatedAt?: string;
  }>;
  lastRefreshedAt: string;
};

export type OtpRequestResult = {
  success: boolean;
  allowed?: boolean;
  message?: string;
};

export const sharedExportApi = {
  create: async (payload: {
    surveyId: string;
    recipientEmail: string;
    format: SharedExportFormat;
    mode: SharedExportMode;
    sendEmail: boolean;
  }): Promise<SharedLinkResponse> => {
    const response = await apiClient.post("/shared-exports", payload);
    return response.data?.data ?? {};
  },
};

export const sharedDashboardApi = {
  create: async (payload: {
    surveyId: string;
    recipientEmail: string;
    sendEmail: boolean;
  }): Promise<SharedLinkResponse> => {
    const response = await apiClient.post("/shared-dashboard-links", payload);
    return response.data?.data ?? {};
  },
};

export const publicSharedExportApi = {
  getMeta: async (token: string): Promise<SharedExportMeta> => {
    const response = await apiClient.get(`/public/shared-exports/${token}/meta`);
    return response.data?.data;
  },
  requestOtp: async (token: string, email: string): Promise<OtpRequestResult> => {
    const response = await apiClient.post(`/public/shared-exports/${token}/request-otp`, { email });
    return response.data?.data ?? { success: false, allowed: false };
  },
  verifyOtp: async (token: string, payload: { email: string; otp: string }): Promise<{ grantToken: string; expiresInSeconds: number }> => {
    const response = await apiClient.post(`/public/shared-exports/${token}/verify-otp`, payload);
    return response.data?.data;
  },
  download: async (token: string, payload: { email: string; grantToken: string }) => {
    return apiClient.post(`/public/shared-exports/${token}/download`, payload, {
      responseType: "blob",
    });
  },
};

export const publicSharedDashboardApi = {
  getMeta: async (token: string): Promise<SharedDashboardMeta> => {
    const response = await apiClient.get(`/public/shared-dashboard-links/${token}/meta`);
    return response.data?.data;
  },
  requestOtp: async (token: string, email: string): Promise<OtpRequestResult> => {
    const response = await apiClient.post(`/public/shared-dashboard-links/${token}/request-otp`, { email });
    return response.data?.data ?? { success: false, allowed: false };
  },
  verifyOtp: async (token: string, payload: { email: string; otp: string }): Promise<{ grantToken: string; expiresInSeconds: number }> => {
    const response = await apiClient.post(`/public/shared-dashboard-links/${token}/verify-otp`, payload);
    return response.data?.data;
  },
  getData: async (token: string, payload: { grantToken: string }): Promise<SharedDashboardPayload> => {
    const response = await apiClient.post(`/public/shared-dashboard-links/${token}/data`, payload);
    return response.data?.data;
  },
};
