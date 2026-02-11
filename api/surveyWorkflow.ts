import apiClient from "@/lib/api-client"
import { SurveyWorkflow } from "@/src/shared/types/survey";
import { decompressJson } from "@/lib/utils";

export const surveyWorkflowApi = {
    getLatestWorkflowBySurveyId: async (surveyId: string): Promise<SurveyWorkflow> => {
        const response = await apiClient.get(`/workflows/${surveyId}/latest`)
        const data = response.data.data;
        
        if (data && data.runtimeJson && data.designJson) {
            return {
                ...data,
                runtimeJson: decompressJson(data.runtimeJson),
                designJson: decompressJson(data.designJson)
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

    getWorkflowsMetadata: async (surveyId: string): Promise<any[]> => {
        const response = await apiClient.get(`/workflows/${surveyId}/metadata`);
        return response.data.data || [];
    },

    getWorkflowById: async (workflowId: string): Promise<any> => {
        const response = await apiClient.get(`/workflows/detail/${workflowId}`);
        const data = response.data.data;

        if (data && data.runtimeJson && data.designJson) {
            return {
                ...data,
                runtimeJson: decompressJson(data.runtimeJson),
                designJson: decompressJson(data.designJson)
            };
        }
        
        return data;
    }
}