import apiClient from "@/lib/api-client";
import { createIdempotencyKey } from "@/lib/idempotency";
import type { AcceptedOperation } from "./survey";

export const reconcileApi = {
    disqualifyResponses: async (surveyId: string, responseIds: string[]): Promise<AcceptedOperation> => {
        const response = await apiClient.post(`/reconcile/surveys/${surveyId}/disqualify`, {
            responseIds
        }, {
            headers: {
                "Idempotency-Key": createIdempotencyKey(`reconcile-${surveyId}`),
            },
        });
        return response.data?.data as AcceptedOperation;
    }
};
