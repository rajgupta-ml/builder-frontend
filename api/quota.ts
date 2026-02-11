import apiClient from "@/lib/api-client";
import { SurveyQuota } from "@/src/shared/types/survey";

export const quotaApi = {
  getQuotas: async (surveyId: string): Promise<SurveyQuota[]> => {
    const response = await apiClient.get<{ data: SurveyQuota[] }>(`/quotas/${surveyId}`);
    return response.data.data;
  },

  createQuota: async (surveyId: string, data: Omit<SurveyQuota, 'id' | 'createdAt' | 'surveyId'>): Promise<SurveyQuota> => {
    const response = await apiClient.post<{ data: SurveyQuota }>(`/quotas/${surveyId}`, data);
    return response.data.data;
  },

  deleteQuota: async (id: string): Promise<void> => {
    await apiClient.delete(`/quotas/${id}`);
  },

  toggleQuota: async (id: string, isActive: boolean): Promise<SurveyQuota> => {
    const response = await apiClient.patch<{ data: SurveyQuota }>(`/quotas/${id}`, { isActive });
    return response.data.data;
  },
};
