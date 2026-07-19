import apiClient from "@/lib/api-client"
import { SurveyWorkflow } from "@/src/shared/types/survey";
import { decompressJson } from "@/lib/utils";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";

type RequestOptions = {
    signal?: AbortSignal;
};

export interface WorkflowValidationIssue {
    type: "error" | "warning";
    code: string;
    message: string;
    nodeId?: string;
    field?: string;
}

export interface WorkflowValidationResult {
    isValid: boolean;
    issues: WorkflowValidationIssue[];
    error?: string;
}

export interface OpenEndQualityPolicyPreview {
    enabled: boolean;
    source: "AI_INFERRED" | "SYSTEM_DEFAULT" | "CREATOR_OVERRIDE";
    confidence: number;
    needsCreatorReview: boolean;
    answerIntent: "IDENTITY" | "CONTACT" | "SHORT_FACT" | "YES_NO" | "SINGLE_WORD" | "REASON_OPINION" | "LONG_FEEDBACK" | "AMBIGUOUS";
    expectedAnswerShape: "single_word" | "short_phrase" | "sentence" | "paragraph";
    checks: {
        tooShort: boolean;
        keyboardMash: boolean;
        duplicateWithinSession: boolean;
        relevance: boolean;
        gibberish: boolean;
        languageMismatch: boolean;
        aiGeneratedText: boolean;
    };
    thresholds: {
        minWords?: number;
        minCharacters?: number;
    };
    reasonCode: string;
}

export interface OpenEndQualityPreviewResult {
    automaticPolicies: Record<string, OpenEndQualityPolicyPreview>;
    policies: Record<string, OpenEndQualityPolicyPreview>;
}

type WorkflowImportStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface WorkflowImportJobStatus {
    id: string;
    surveyId: string;
    status: WorkflowImportStatus;
    sourceFileName: string;
    sourceFileMime: string;
    sourceFileBytes: number;
    warnings: string[];
    assumptions: string[];
    mappingReport: string[];
    errorCode: string | null;
    errorDetail: string | null;
    resultWorkflowId: string | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
    qualityScore: number;
    selectedStrategy: "primary_model" | "deterministic_rebuild" | "reasoning_retry";
    branchRulesDetected: number;
    branchRulesApplied: number;
    skipConditionsDetected: number;
    skipConditionsApplied: number;
    legacyWhenParsedCount: number;
    ambiguousLogicCount: number;
    placeholderLabelCount: number;
    emptyChoiceNodeCount: number;
    debug?: {
        canonical: unknown;
        candidates: unknown;
        selectedCandidate: unknown;
    };
}

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

    validateWorkflow: async (
        data: { surveyId: string; designJson: { nodes: any[]; edges: any[] } },
        options?: RequestOptions
    ): Promise<WorkflowValidationResult> => {
        const response = await apiClient.post(`/workflows/validate`, data, options);
        const parsed = z.object({ data: z.unknown() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid workflow validate payload shape",
                details: { endpoint: "/workflows/validate" },
            });
            return { isValid: false, issues: [{ type: "error", code: "VALIDATION_API_SHAPE", message: "Invalid validation response shape." }] };
        }
        const payload = parsed.data.data as WorkflowValidationResult;
        if (!payload || !Array.isArray(payload.issues)) {
            return { isValid: false, issues: [{ type: "error", code: "VALIDATION_API_MISSING", message: "Validation service returned invalid payload." }] };
        }
        return payload;
    },

    createWorkflow: async (data: { surveyId: string, runtimeJson: any, designJson: any }) => {
        const response = await apiClient.post(`/workflows`, data);
        return response.data.data;
    },


    previewOpenEndQuality: async (
        data: { surveyId: string; runtimeJson: any; designJson: { nodes: any[]; edges: any[] } },
        options?: RequestOptions
    ): Promise<OpenEndQualityPreviewResult> => {
        const response = await apiClient.post('/workflows/open-end-quality-preview', data, { signal: options?.signal });
        const parsed = z.object({ data: z.unknown() }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid open-end quality preview payload shape",
                details: { endpoint: "/workflows/open-end-quality-preview" },
            });
            return { automaticPolicies: {}, policies: {} };
        }
        const payload = parsed.data.data as Partial<OpenEndQualityPreviewResult> | null | undefined;
        return {
            automaticPolicies: payload?.automaticPolicies || {},
            policies: payload?.policies || {},
        };
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
    },
    createAiImportJob: async (payload: {
        surveyId: string;
        fileName: string;
        mimeType: string;
        fileBase64: string;
        languageHint?: string;
        mode?: "AUTO" | "LIVE" | "TEST";
        strictLogic?: boolean;
    }): Promise<{ jobId: string; status: WorkflowImportStatus }> => {
        const response = await apiClient.post("/workflows/import-ai", payload);
        const parsed = z.object({
            data: z.object({
                jobId: z.string(),
                status: z.enum(["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED"]),
            }),
        }).safeParse(response.data);

        if (!parsed.success) {
            throw new Error("Invalid AI import create response");
        }
        return parsed.data.data;
    },
    getAiImportJob: async (jobId: string): Promise<WorkflowImportJobStatus> => {
        const response = await apiClient.get(`/workflows/import-ai/${jobId}`);
        const parsed = z.object({ data: z.unknown() }).safeParse(response.data);
        if (!parsed.success) {
            throw new Error("Invalid AI import status response");
        }
        return parsed.data.data as WorkflowImportJobStatus;
    },
    getAiImportResult: async (jobId: string): Promise<{
        jobId: string;
        status: WorkflowImportStatus;
        warnings: string[];
        assumptions: string[];
        mappingReport: string[];
        errorCode: string | null;
        errorDetail: string | null;
        workflowId: string | null;
        completedAt: string | null;
        qualityScore: number;
        selectedStrategy: "primary_model" | "deterministic_rebuild" | "reasoning_retry";
        branchRulesDetected: number;
        branchRulesApplied: number;
        skipConditionsDetected: number;
        skipConditionsApplied: number;
        legacyWhenParsedCount: number;
        ambiguousLogicCount: number;
        placeholderLabelCount: number;
        emptyChoiceNodeCount: number;
        debug?: {
            canonical: unknown;
            candidates: unknown;
            selectedCandidate: unknown;
        };
    }> => {
        const response = await apiClient.get(`/workflows/import-ai/${jobId}/result`);
        const parsed = z.object({ data: z.unknown() }).safeParse(response.data);
        if (!parsed.success) {
            throw new Error("Invalid AI import result response");
        }
        return parsed.data.data as any;
    },
}
