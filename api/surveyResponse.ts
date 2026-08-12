import apiClient from "@/lib/api-client"
import { toUserMessage } from "@/lib/api-error";
import { toast } from "sonner";
import { z } from "zod";
import { reportError } from "@/lib/error-reporter";
import type { AcceptedOperation } from "./survey";
import { createIdempotencyKey } from "@/lib/idempotency";
import { getPublicEnv } from "@/lib/env";

type RequestOptions = {
    signal?: AbortSignal;
};

type ResponseFeedOptions = RequestOptions & {
    page?: number;
    limit?: number;
    respondentId?: string;
    status?: string;
};

export interface PaginatedFeedResult<T = any> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        orderedHeaders?: string[];
    };
}

export type MetricsRealtimePayload = {
    surveyId: string;
    mode: "LIVE" | "TEST";
    metrics: {
        views: number;
        starts: number;
        completes: number;
        dropped: number;
        disqualified: number;
        overQuota: number;
        securityTerminate: number;
        qualityTerminate: number;
        ir: number;
        avgTime: number;
    };
    eventsRead?: number;
    updatedAt: string;
};

type MetricsStreamHandlers = {
    signal?: AbortSignal;
    onMetricsUpdated: (payload: MetricsRealtimePayload) => void;
    onConnected?: () => void;
};

export type QualitySummary = {
    averageScore: number | null;
    totalResponses: number;
    scoredResponses: number;
    stateCounts: Record<string, number>;
    detectorCounts: Record<string, number>;
    detectorReviewMetrics: Record<string, {
        activeCount: number;
        reviewedValidCount: number;
        reviewedConfirmedCount: number;
    }>;
};

export type QualityResponseListItem = {
    id: string;
    respondentId: string;
    status: string | null;
    outcome: string | null;
    mode: "LIVE" | "TEST";
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string | null;
    qualityScore: number | null;
    qualityState: string | null;
    qualityProcessingStatus: string | null;
    qualityScoreVersion: string | null;
    qualityCriticalOverride: boolean | null;
    qualityReviewStatus: string | null;
    qualityReviewReasonCode: string | null;
    qualityReviewedAt: string | null;
    activeFlagCount: number;
};

export type QualityResponseFlag = {
    id: string;
    detectorCode: string;
    flagCode: string;
    scopeKey: string;
    scoreGroup: string;
    scoreImpact: number;
    severity: string;
    source: string;
    confidence: number | null;
    questionId: string | null;
    evidence: Record<string, unknown> | null;
    isActive: boolean;
    isRetroactive: boolean;
    settingsVersion: number | null;
    detectedAt: string;
    retiredAt: string | null;
};

export type QualityScoreHistoryItem = {
    id: string;
    reason: string;
    previousScore: number | null;
    newScore: number | null;
    previousState: string | null;
    newState: string | null;
    previousProcessingStatus: string | null;
    newProcessingStatus: string | null;
    previousCriticalOverride: boolean | null;
    newCriticalOverride: boolean | null;
    settingsVersion: number | null;
    scoreVersion: string | null;
    reasonPayload: Record<string, unknown> | null;
    createdAt: string;
};

export type QualityOperationStatus = {
    id: string;
    status: string;
    errorCode: string | null;
    errorDetail: string | null;
    attemptCount: number;
    resultPayload: Record<string, unknown> | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
};

export type OpenEndQualitySummary = {
    answerCount: number;
    eligibleAnswerCount: number;
    aiEligibleAnswerCount: number;
    checkedAnswerCount: number;
    aiJudgeOperation: QualityOperationStatus | null;
};

export type QualityResponseDetail = {
    id: string;
    surveyId: string;
    respondentId: string;
    status: string | null;
    outcome: string | null;
    mode: "LIVE" | "TEST";
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string | null;
    qualityScore: number | null;
    qualityState: string | null;
    qualityProcessingStatus: string | null;
    qualityScoreVersion: string | null;
    qualityScoredAt: string | null;
    qualityCriticalOverride: boolean | null;
    qualityReviewStatus: string | null;
    qualityReviewReasonCode: string | null;
    qualityReviewedAt: string | null;
    qualitySettingsVersion: number | null;
    qualityFlags: QualityResponseFlag[];
    qualityScoreHistory: QualityScoreHistoryItem[];
    openEndQuality?: OpenEndQualitySummary;
};

export type QualityDetectorSettings = {
    enabled: boolean;
    scoreImpact?: number;
    severity?: string;
    thresholdSeconds?: number;
    expectedSurveyRatio?: number;
    minimumFloorSeconds?: number;
    expectedTimeRatio?: number;
    wordsPerSecond?: number;
    interactionFloorSeconds?: number;
    minResponses?: number;
    nearStraightLineRatio?: number;
    straightLineScoreImpact?: number;
    straightLineSeverity?: string;
    nearStraightLineScoreImpact?: number;
    nearStraightLineSeverity?: string;
    patternResponseScoreImpact?: number;
    patternResponseSeverity?: string;
};

export type QualitySettings = {
    settingId: string | null;
    version: number | null;
    guardrailVersion: number;
    isEnabled: boolean;
    scoreVersion: string;
    thresholds: {
        cleanMin: number;
        watchlistMin: number;
        flaggedMin: number;
    };
    scoreGroupCaps: Record<string, number>;
    detectors: Record<string, QualityDetectorSettings>;
    compliancePolicy?: {
        duplicateDeviceTestOnly: boolean;
        duplicateDeviceLiveApprovalRecorded: boolean;
    };
    createdAt: string | null;
    updatedAt: string | null;
};

const parseSseFrame = (frame: string) => {
    let event = "message";
    const dataLines: string[] = [];

    for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
            event = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trimStart());
        }
    }

    return { event, data: dataLines.join("\n") };
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

    subscribeToMetricsUpdates: async (
        surveyId: string,
        handlers: MetricsStreamHandlers
    ): Promise<void> => {
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        if (!token) {
            throw new Error("Missing auth token for metrics stream");
        }

        const { NEXT_PUBLIC_API_URL } = getPublicEnv();
        const response = await fetch(`${NEXT_PUBLIC_API_URL}/responses/metrics/${surveyId}/stream`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "text/event-stream",
            },
            cache: "no-store",
            signal: handlers.signal,
        });

        if (!response.ok || !response.body) {
            throw new Error(`Metrics stream failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() || "";

            for (const frame of frames) {
                const { event, data } = parseSseFrame(frame);
                if (!data) continue;

                if (event === "connected") {
                    handlers.onConnected?.();
                    continue;
                }

                if (event !== "metrics.updated") continue;

                try {
                    handlers.onMetricsUpdated(JSON.parse(data) as MetricsRealtimePayload);
                } catch (error) {
                    reportError({
                        kind: "api",
                        message: "Invalid metrics stream payload",
                        details: { endpoint: `/responses/metrics/${surveyId}/stream`, error },
                    });
                }
            }
        }
    },

    getResponses: async (surveyId: string, mode?: 'LIVE' | 'TEST', options?: ResponseFeedOptions): Promise<PaginatedFeedResult> => {
        const response = await apiClient.get(`/responses/responses/${surveyId}`, {
            ...options,
            params: {
                ...(mode ? { mode } : {}),
                ...(options?.page ? { page: options.page } : {}),
                ...(options?.limit ? { limit: options.limit } : {}),
                ...(options?.respondentId ? { respondentId: options.respondentId } : {}),
                ...(options?.status ? { status: options.status } : {}),
            },
        });
        const parsed = z.object({
            data: z.object({
                data: z.array(z.unknown()),
                meta: z.object({
                    page: z.number().int().positive(),
                    limit: z.number().int().positive(),
                    total: z.number().int().nonnegative(),
                    totalPages: z.number().int().positive(),
                    orderedHeaders: z.array(z.string()).optional(),
                }).optional(),
            }),
        }).safeParse(response.data);
        if (!parsed.success) {
            reportError({
                kind: "api",
                message: "Invalid responses payload shape",
                details: { endpoint: `/responses/responses/${surveyId}` },
            });
            return {
                data: [],
                meta: {
                    page: options?.page || 1,
                    limit: options?.limit || 10,
                    total: 0,
                    totalPages: 1,
                },
            };
        }
        const payload = parsed.data.data;
        return {
            data: payload.data,
            meta: payload.meta || {
                page: options?.page || 1,
                limit: options?.limit || 10,
                total: payload.data.length,
                totalPages: 1,
            },
        };
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

    forceResync: async (surveyId: string, payload?: { full?: boolean; limit?: number; async?: boolean }): Promise<AcceptedOperation> => {
        const response = await apiClient.post(`/responses/resync/${surveyId}`, payload || {}, {
            headers: {
                "Idempotency-Key": createIdempotencyKey(`resync-${surveyId}`),
            },
        });
        const accepted = (response.data?.data ?? response.data) as Partial<AcceptedOperation> | undefined;
        if (!accepted || typeof accepted.operationId !== "string" || accepted.operationId.length === 0) {
            reportError({
                kind: "api",
                message: "Invalid resync accepted payload",
                details: { endpoint: `/responses/resync/${surveyId}` },
            });
            throw new Error("Invalid resync accepted payload");
        }
        return accepted as AcceptedOperation;
    },

    getResyncStatus: async (surveyId: string) => {
        const response = await apiClient.get(`/responses/resync/${surveyId}/status`);
        return response.data?.data;
    },

    getQualitySummary: async (surveyId: string, mode?: 'LIVE' | 'TEST', options?: RequestOptions): Promise<QualitySummary> => {
        const response = await apiClient.get(`/responses/quality/${surveyId}/summary`, {
            ...options,
            params: {
                ...(mode ? { mode } : {}),
            },
        });
        const payload = response.data?.data;
        if (!payload || typeof payload !== 'object') {
            reportError({
                kind: 'api',
                message: 'Invalid quality summary payload shape',
                details: { endpoint: `/responses/quality/${surveyId}/summary` },
            });
            return {
                averageScore: null,
                totalResponses: 0,
                scoredResponses: 0,
                stateCounts: {},
                detectorCounts: {},
                detectorReviewMetrics: {},
            };
        }
        return payload as QualitySummary;
    },

    getQualityResponses: async (
        surveyId: string,
        options?: RequestOptions & {
            mode?: 'LIVE' | 'TEST';
            page?: number;
            limit?: number;
            state?: string;
            reviewStatus?: string;
        }
    ): Promise<PaginatedFeedResult<QualityResponseListItem>> => {
        const response = await apiClient.get(`/responses/quality/${surveyId}`, {
            ...options,
            params: {
                ...(options?.mode ? { mode: options.mode } : {}),
                ...(options?.page ? { page: options.page } : {}),
                ...(options?.limit ? { limit: options.limit } : {}),
                ...(options?.state ? { state: options.state } : {}),
                ...(options?.reviewStatus ? { reviewStatus: options.reviewStatus } : {}),
            },
        });
        const payload = response.data?.data;
        if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
            reportError({
                kind: 'api',
                message: 'Invalid quality responses payload shape',
                details: { endpoint: `/responses/quality/${surveyId}` },
            });
            return {
                data: [],
                meta: {
                    page: options?.page || 1,
                    limit: options?.limit || 25,
                    total: 0,
                    totalPages: 1,
                },
            };
        }
        return payload as PaginatedFeedResult<QualityResponseListItem>;
    },

    getQualityResponseDetail: async (surveyId: string, responseId: string, options?: RequestOptions): Promise<QualityResponseDetail> => {
        const response = await apiClient.get(`/responses/quality/${surveyId}/${responseId}`, options);
        const payload = response.data?.data;
        if (!payload || typeof payload !== 'object') {
            reportError({
                kind: 'api',
                message: 'Invalid quality response detail payload shape',
                details: { endpoint: `/responses/quality/${surveyId}/${responseId}` },
            });
            throw new Error('Invalid quality response detail payload');
        }
        return payload as QualityResponseDetail;
    },

    reviewQualityResponse: async (
        surveyId: string,
        responseId: string,
        input: {
            reviewStatus: string;
            reasonCode?: string;
            note?: string;
            reviewedFlagIds?: string[];
        }
    ) => {
        const response = await apiClient.post(`/responses/quality/${surveyId}/${responseId}/review`, input);
        return response.data?.data;
    },

    getQualitySettings: async (surveyId: string, options?: RequestOptions): Promise<QualitySettings> => {
        const response = await apiClient.get(`/responses/quality/${surveyId}/settings`, options);
        const payload = response.data?.data;
        if (!payload || typeof payload !== 'object') {
            reportError({
                kind: 'api',
                message: 'Invalid quality settings payload shape',
                details: { endpoint: `/responses/quality/${surveyId}/settings` },
            });
            throw new Error('Invalid quality settings payload');
        }
        return payload as QualitySettings;
    },

    updateQualitySettings: async (
        surveyId: string,
        input: {
            guardrailVersion?: number;
            scoreVersion?: string;
            thresholds: {
                cleanMin: number;
                watchlistMin: number;
                flaggedMin: number;
            };
            scoreGroupCaps: Record<string, number>;
            detectors: Record<string, QualityDetectorSettings>;
        }
    ): Promise<QualitySettings> => {
        const response = await apiClient.put(`/responses/quality/${surveyId}/settings`, input);
        const payload = response.data?.data;
        if (!payload || typeof payload !== 'object') {
            reportError({
                kind: 'api',
                message: 'Invalid quality settings update payload shape',
                details: { endpoint: `/responses/quality/${surveyId}/settings` },
            });
            throw new Error('Invalid quality settings update payload');
        }
        return payload as QualitySettings;
    },

    exportQualityResponses: async (
        surveyId: string,
        format: 'csv' | 'xlsx' | 'json' = 'csv',
        mode?: 'LIVE' | 'TEST',
        detailed = false
    ) => {
        try {
            const endpoint = detailed
                ? `/responses/quality/${surveyId}/export/detailed`
                : `/responses/quality/${surveyId}/export`;
            const response = await apiClient.get(endpoint, {
                params: mode ? { format, mode } : { format },
                responseType: 'blob',
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const modeLabel = mode || 'ALL';
            const fallbackFilename = `${detailed ? 'quality-detailed-export' : 'quality-export'}-${surveyId}-${modeLabel}-${timestamp}.${format}`;
            const contentDisposition = response.headers['content-disposition'];
            const filenameMatch = contentDisposition?.match(/filename="?([^";]+)"?/);
            const filename = filenameMatch?.[1] || fallbackFilename;
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Quality export failed", error);
            toast.error(toUserMessage(error, "Failed to export response quality. Please try again."));
        }
    },

    exportResponses: async (surveyId: string, format: 'csv' | 'xlsx' | 'spss' = 'csv', mode?: 'LIVE' | 'TEST') => {
        try {
            const params = mode ? { format, mode } : { format };
            const response = await apiClient.get(`/responses/export/${surveyId}`, {
                params,
                responseType: 'blob'
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = format === 'spss' ? 'sps' : format;
            const modeLabel = mode || 'ALL';
            const filename = `survey-export-${surveyId}-${modeLabel}-${timestamp}.${extension}`;

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
