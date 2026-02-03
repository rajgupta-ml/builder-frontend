import apiClient from "@/lib/api-client"
import { StartResponseParams, UpdateResponseParams } from "@/src/shared/types/survey";

export const surveyResponseApi = {
    startResponse: async (params: StartResponseParams) => {
        const response = await apiClient.post("/responses/start", params)
        return response.data.data
    },

    updateResponse: async (params: UpdateResponseParams) => {
        const { id, ...data } = params;
        const response = await apiClient.put(`/responses/${id}`, data)
        return response.data
    },

    sendHeartbeat: async (id: string) => {
        await apiClient.post(`/responses/${id}/heartbeat`);
    },

    getMetrics: async (surveyId: string) => {
        const response = await apiClient.get(`/responses/metrics/${surveyId}`);
        return response.data.data;
    },

    getResponses: async (surveyId: string) => {
        const response = await apiClient.get(`/responses/responses/${surveyId}`);
        return response.data.data;
    },

    getAllUserResponses: async () => {
        const response = await apiClient.get('/responses/all');
        return response.data.data;
    }
}
