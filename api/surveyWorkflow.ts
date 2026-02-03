import apiClient from "@/lib/api-client"
import { SurveyWorkflow } from "@/src/shared/types/survey";

export const surveyWorkflowApi = {
    getLatestWorkflowBySurveyId: async (surveyId: string): Promise<SurveyWorkflow> => {
        const response = await apiClient.get(`/workflows/${surveyId}/latest`)
        return response.data.data
    }   
}