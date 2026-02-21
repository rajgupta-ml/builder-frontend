import apiClient from "@/lib/api-client";
import { reportError } from "@/lib/error-reporter";

export type OperationStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface OperationRecord {
    id: string;
    operationType: string;
    status: OperationStatus;
    targetType: string;
    targetId: string;
    requestedByUserId: string;
    requestPayload?: unknown;
    progress?: unknown;
    resultPayload?: unknown;
    errorCode?: string | null;
    errorDetail?: string | null;
    attemptCount: number;
    createdAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    updatedAt: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const operationsApi = {
    getOperation: async (operationId: string): Promise<OperationRecord> => {
        const response = await apiClient.get(`/operations/${operationId}`);
        const data = response.data?.data;
        if (!data || typeof data !== "object") {
            reportError({
                kind: "api",
                message: "Invalid operation status payload",
                details: { endpoint: `/operations/${operationId}` },
            });
            throw new Error("Invalid operation status payload");
        }
        return data as OperationRecord;
    },

    getLatestOperation: async (operationType: string, targetId: string): Promise<OperationRecord> => {
        const response = await apiClient.get("/operations", {
            params: { operationType, targetId }
        });
        const data = response.data?.data;
        if (!data || typeof data !== "object") {
            reportError({
                kind: "api",
                message: "Invalid latest operation payload",
                details: { endpoint: "/operations", operationType, targetId },
            });
            throw new Error("Invalid latest operation payload");
        }
        return data as OperationRecord;
    },

    waitForOperation: async (
        operationId: string,
        options?: { timeoutMs?: number; intervalMs?: number }
    ): Promise<OperationRecord> => {
        const timeoutMs = options?.timeoutMs ?? 90000;
        const intervalMs = options?.intervalMs ?? 1500;
        const startedAt = Date.now();
        let last: OperationRecord | null = null;

        while (Date.now() - startedAt < timeoutMs) {
            const op = await operationsApi.getOperation(operationId);
            last = op;
            if (op.status === "SUCCEEDED" || op.status === "FAILED" || op.status === "CANCELLED") {
                return op;
            }
            await sleep(intervalMs);
        }

        const timeoutError = new Error("Operation is still processing");
        (timeoutError as any).code = "OPERATION_TIMEOUT";
        (timeoutError as any).operation = last;
        throw timeoutError;
    },
};

