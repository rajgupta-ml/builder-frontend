import apiClient from "@/lib/api-client";
import { Survey, Surveys } from "@/src/shared/types/survey";
import { createIdempotencyKey } from "@/lib/idempotency";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

type RequestOptions = {
  signal?: AbortSignal;
};

export interface AcceptedOperation {
  operationId: string;
  operationType: string;
  status: "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  acceptedAt: string;
}

export const surveyApi = {
  // Done
  getSurveys: async (options?: RequestOptions): Promise<Surveys[]> => {
    const response = await apiClient.get<{ data: Surveys[] }>("/surveys", options);
    const parsed = z.object({ data: z.array(z.unknown()) }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid surveys response shape",
        details: { endpoint: "/surveys" },
      });
      return [];
    }
    return parsed.data.data as Surveys[];
  },

  // Done
  getSurvey: async (id: string, options?: RequestOptions): Promise<Survey> => {
    const response = await apiClient.get<{ data: Survey }>(`/surveys/${id}`, options);
    const parsed = z.object({ data: z.record(z.unknown()) }).safeParse(response.data);
    if (!parsed.success) {
      reportError({
        kind: "api",
        message: "Invalid survey response shape",
        details: { endpoint: `/surveys/${id}`, surveyId: id },
      });
      throw new Error("Invalid survey payload");
    }
    return parsed.data.data as unknown as Survey;
  },

  // Done
  createSurvey: async (data: { name: string; description?: string; client: string }): Promise<Survey> => {
    const response = await apiClient.post<{ data: Survey }>("/surveys", data);
    return response.data.data;
  },

  updateSurvey: async (id: string, data: {
    name?: string;
    description?: string;
    redirectUrl?: string | null;
    overQuotaUrl?: string | null;
    securityTerminateUrl?: string | null;
    globalQuota?: number | null;
    privacyConfig?: {
      piiOverrideDenylist?: string[];
    };
  }): Promise<void> => {
    await apiClient.put(`/surveys/${id}`, data);
  },

  // Done
  deleteSurvey: async (id: string): Promise<void> => {
    await apiClient.delete(`/surveys/${id}`);
  },

  publish: async (surveyId: string, mode: 'LIVE' | 'TEST'): Promise<AcceptedOperation> => {
        const response = await apiClient.post(`/surveys/${surveyId}/publish`, { mode }, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`publish-${surveyId}-${mode.toLowerCase()}`),
          },
        });
        return response.data?.data as AcceptedOperation;
    },
  
    pause: async (surveyId: string): Promise<AcceptedOperation> => {
        const response = await apiClient.post(`/surveys/${surveyId}/pause`, {}, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`pause-${surveyId}`),
          },
        });
        return response.data?.data as AcceptedOperation;
    },
  
    close: async (surveyId: string): Promise<AcceptedOperation> => {
        const response = await apiClient.post(`/surveys/${surveyId}/close`, {}, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`close-${surveyId}`),
          },
        });
        return response.data?.data as AcceptedOperation;
    },

    unpublish: async (surveyId: string): Promise<AcceptedOperation> => {
        const response = await apiClient.post(`/surveys/${surveyId}/unpublish`, {}, {
          headers: {
            "Idempotency-Key": createIdempotencyKey(`unpublish-${surveyId}`),
          },
        });
        return response.data?.data as AcceptedOperation;
    }
  };
