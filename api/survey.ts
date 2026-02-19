import apiClient from "@/lib/api-client";
import { Survey, Surveys } from "@/src/shared/types/survey";
import { createIdempotencyKey } from "@/lib/idempotency";

export const surveyApi = {
  // Done
  getSurveys: async (): Promise<Surveys[]> => {
    const response = await apiClient.get<{ data: Surveys[] }>("/surveys");
    return response.data.data;
  },

  // Done
  getSurvey: async (id: string): Promise<Survey> => {
    const response = await apiClient.get<{ data: Survey }>(`/surveys/${id}`);
    return response.data.data;
  },

  // Done
  createSurvey: async (data: { name: string; description?: string; client: string }): Promise<Survey> => {
    const response = await apiClient.post<{ data: Survey }>("/surveys", data);
    return response.data.data;
  },

  updateSurvey: async (id: string, data: { name?: string; description?: string; redirectUrl?: string | null; overQuotaUrl?: string | null; securityTerminateUrl?: string | null; globalQuota?: number | null }): Promise<void> => {
    await apiClient.put(`/surveys/${id}`, data);
  },

  // Done
  deleteSurvey: async (id: string): Promise<void> => {
    await apiClient.delete(`/surveys/${id}`);
  },

  publish: async (surveyId: string, mode: 'LIVE' | 'TEST'): Promise<any> => {
        const response = await apiClient.post(`/surveys/${surveyId}/publish`, { mode }, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`publish-${surveyId}-${mode.toLowerCase()}`),
          },
        });
        return response.data;
    },
  
    pause: async (surveyId: string): Promise<void> => {
        await apiClient.post(`/surveys/${surveyId}/pause`, {}, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`pause-${surveyId}`),
          },
        });
    },
  
    close: async (surveyId: string): Promise<void> => {
        await apiClient.post(`/surveys/${surveyId}/close`, {}, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`close-${surveyId}`),
          },
        });
    }
  };
