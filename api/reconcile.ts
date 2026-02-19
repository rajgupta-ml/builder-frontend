import apiClient from "@/lib/api-client";
import { createIdempotencyKey } from "@/lib/idempotency";

export const reconcileApi = {
    disqualifyResponses: async (surveyId: string, responseIds: string[]) => {
        const response = await apiClient.post(`/reconcile/surveys/${surveyId}/disqualify`, {
            responseIds
        }, {
            headers: {
                "Idempotency-Key": createIdempotencyKey(`reconcile-${surveyId}`),
            },
        });
        return response.data;
    }
};
