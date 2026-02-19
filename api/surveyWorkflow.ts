import apiClient from "@/lib/api-client"
import { SurveyWorkflow } from "@/src/shared/types/survey";
import { decompressJson } from "@/lib/utils";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

type RequestOptions = {
    signal?: AbortSignal;
};

export const surveyWorkflowApi = {
    getLatestWorkflowBySurveyId: async (surveyId: string, options?: RequestOptions): Promise<SurveyWorkflow> => {
        const response = await apiClient.get(`/workflows/${surveyId}/latest`, options)
        const parsed = z.object({ data: z.unknown().nullable().optional() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid workflow latest payload shape",
                details: { endpoint: `/workflows/${surveyId}/latest` },
            });
            throw new Error("Invalid workflow payload");
        }
        const data = parsed.data.data as any;
        
        if (data && data.runtimeJson && data.designJson) {
            const runtimeJson = decompressJson(data.runtimeJson);
            const designJson = decompressJson(data.designJson);
            if (!runtimeJson || !designJson) {
                reportError({
                    kind: "api",
                    message: "Workflow decompression failed",
                    details: { endpoint: `/workflows/${surveyId}/latest` },
                });
                throw new Error("Invalid workflow content");
            }
            return {
                ...data,
                runtimeJson,
                designJson
            };
        }
        
        return data
    },
    autosaveWorkflow: async (data: { surveyId: string, workflowId?: string | null, runtimeJson: any, designJson: any }) => {
        const response = await apiClient.post(`/workflows/autosave`, data);
        return response.data.data;
    },

    createWorkflow: async (data: { surveyId: string, runtimeJson: any, designJson: any }) => {
        const response = await apiClient.post(`/workflows`, data);
        return response.data.data;
    },

    getWorkflowsMetadata: async (surveyId: string, options?: RequestOptions): Promise<any[]> => {
        const response = await apiClient.get(`/workflows/${surveyId}/metadata`, options);
        const parsed = z.object({ data: z.array(z.unknown()).optional() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid workflows metadata payload shape",
                details: { endpoint: `/workflows/${surveyId}/metadata` },
            });
            return [];
        }
        return parsed.data.data || [];
    },

    getWorkflowById: async (workflowId: string, options?: RequestOptions): Promise<any> => {
        const response = await apiClient.get(`/workflows/detail/${workflowId}`, options);
        const parsed = z.object({ data: z.unknown().nullable().optional() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid workflow detail payload shape",
                details: { endpoint: `/workflows/detail/${workflowId}` },
            });
            throw new Error("Invalid workflow payload");
        }
        const data = parsed.data.data as any;

        if (data && data.runtimeJson && data.designJson) {
            const runtimeJson = decompressJson(data.runtimeJson);
            const designJson = decompressJson(data.designJson);
            if (!runtimeJson || !designJson) {
                reportError({
                    kind: "api",
                    message: "Workflow detail decompression failed",
                    details: { endpoint: `/workflows/detail/${workflowId}` },
                });
                throw new Error("Invalid workflow content");
            }
            return {
                ...data,
                runtimeJson,
                designJson
            };
        }
        
        return data;
    }
}
