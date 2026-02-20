import apiClient from "@/lib/api-client"
import { toUserMessage } from "@/lib/api-error";
import { toast } from "sonner";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

type RequestOptions = {
    signal?: AbortSignal;
};

export const surveyResponseApi = {
    getMetrics: async (surveyId: string, options?: RequestOptions): Promise<{ modes: any[] }> => {
        const response = await apiClient.get(`/responses/metrics/${surveyId}`, options);
        const parsed = z.object({ data: z.unknown() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid metrics response shape",
                details: { endpoint: `/responses/metrics/${surveyId}` },
            });
            return { modes: [] };
        }
        const payload = parsed.data.data as any;
        return payload && Array.isArray(payload.modes) ? payload : { modes: [] };
    },

    getResponses: async (surveyId: string, options?: RequestOptions) => {
        const response = await apiClient.get(`/responses/responses/${surveyId}`, options);
        const parsed = z.object({ data: z.unknown() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid responses payload shape",
                details: { endpoint: `/responses/responses/${surveyId}` },
            });
            return [];
        }
        return parsed.data.data;
    },

    getAllUserResponses: async (options?: RequestOptions) => {
        const response = await apiClient.get('/responses/all', options);
        const parsed = z.object({ data: z.array(z.unknown()) }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid all responses payload shape",
                details: { endpoint: "/responses/all" },
            });
            return [];
        }
        return parsed.data.data;
    },

    forceResync: async (surveyId: string, payload?: { full?: boolean; limit?: number; async?: boolean }) => {
        const response = await apiClient.post(`/responses/resync/${surveyId}`, payload || {});
        return response.data?.data;
    },

    getResyncStatus: async (surveyId: string) => {
        const response = await apiClient.get(`/responses/resync/${surveyId}/status`);
        return response.data?.data;
    },

    exportResponses: async (surveyId: string, format: 'csv' | 'xlsx' | 'spss' = 'csv', mode: 'LIVE' | 'TEST' = 'LIVE') => {
        try {
            const response = await apiClient.get(`/responses/export/${surveyId}`, {
                params: { format, mode },
                responseType: 'blob'
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = format === 'spss' ? 'sps' : format;
            const filename = `survey-export-${surveyId}-${mode}-${timestamp}.${extension}`;

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            const contentDisposition = response.headers['content-disposition'];
            let finalFilename = filename;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length === 2)
                    finalFilename = filenameMatch[1];
            }

            link.setAttribute('download', finalFilename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Export failed", error);
            toast.error(toUserMessage(error, "Failed to export responses. Please try again."));
        }
    }
}
