import apiClient from "@/lib/api-client";
import { SurveyQuota } from "@/src/shared/types/survey";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

type RequestOptions = {
  signal?: AbortSignal;
};

export const quotaApi = {
  getQuotas: async (surveyId: string, options?: RequestOptions): Promise<SurveyQuota[]> => {
    const response = await apiClient.get<{ data: SurveyQuota[] }>(`/quotas/${surveyId}`, options);
    const parsed = z.object({ data: z.array(z.unknown()) }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid quotas response shape",
        details: { endpoint: `/quotas/${surveyId}` },
      });
      return [];
    }
    return parsed.data.data as SurveyQuota[];
  },

  createQuota: async (surveyId: string, data: Omit<SurveyQuota, 'id' | 'createdAt' | 'surveyId'>): Promise<SurveyQuota> => {
    const response = await apiClient.post<{ data: SurveyQuota }>(`/quotas/${surveyId}`, data);
    const parsed = z.object({ data: z.record(z.unknown()) }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid quota create response shape",
        details: { endpoint: `/quotas/${surveyId}` },
      });
      throw new Error("Invalid quota payload");
    }
    return parsed.data.data as unknown as SurveyQuota;
  },

  deleteQuota: async (id: string): Promise<void> => {
    await apiClient.delete(`/quotas/${id}`);
  },

  toggleQuota: async (id: string, isActive: boolean): Promise<SurveyQuota> => {
    const response = await apiClient.patch<{ data: SurveyQuota }>(`/quotas/${id}`, { isActive });
    const parsed = z.object({ data: z.record(z.unknown()) }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid quota toggle response shape",
        details: { endpoint: `/quotas/${id}` },
      });
      throw new Error("Invalid quota payload");
    }
    return parsed.data.data as unknown as SurveyQuota;
  },

  updateQuota: async (id: string, data: Partial<Omit<SurveyQuota, 'id' | 'createdAt' | 'surveyId'>>): Promise<SurveyQuota> => {
    const response = await apiClient.put<{ data: SurveyQuota }>(`/quotas/${id}`, data);
    const parsed = z.object({ data: z.record(z.unknown()) }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid quota update response shape",
        details: { endpoint: `/quotas/${id}` },
      });
      throw new Error("Invalid quota payload");
    }
    return parsed.data.data as unknown as SurveyQuota;
  },
};
