import apiClient from "@/lib/api-client";

export const reconcileApi = {
    disqualifyResponses: async (surveyId: string, responseIds: string[]) => {
        const response = await apiClient.post(`/reconcile/surveys/${surveyId}/disqualify`, {
            responseIds
        });
        return response.data;
    }
};
