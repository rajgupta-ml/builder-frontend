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
    }   
}