"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { Survey } from "@/src/shared/types/survey";
import { surveyResponseApi } from "@/api/surveyResponse";
import type { MetricsRealtimePayload } from "@/api/surveyResponse";
import { operationsApi } from "@/api/operations";
import { sharedDashboardApi, sharedExportApi, type SharedExportFormat, type SharedExportMode } from "@/api/sharedLinks";
import { toast } from "sonner";
import {
    IconClick,
    IconCheck,
    IconClock,
    IconChartBar,
    IconDownload,
    IconTable,
    IconRefresh,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconSettings,
    IconDotsVertical,
    IconMailForward,
    IconLink,
    IconLayoutDashboard,
    IconShare,
    IconX
} from "@tabler/icons-react";
import { motion } from "motion/react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from "recharts";
import { cn } from "@/lib/utils";
import { SurveySettingsModal } from "@/components/modals/SurveySettingsModal";
import { SurveyQuotaModal } from "@/components/modals/SurveyQuotaModal";
import { ReconcileResponseModal } from "@/components/modals/ReconcileResponseModal";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { safeDateTime, safeIdShort } from "@/lib/safe-format";
import { toUserMessage } from "@/lib/api-error";
import { getStoredUserScopes, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { SurveyNavTabs } from "@/components/editor/SurveyNavTabs";

interface MetricData {
    mode: string;
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
}

const toValidTimestamp = (value: unknown): number | null => {
    if (!value) return null;
    const ms = new Date(value as string | number).getTime();
    return Number.isNaN(ms) ? null : ms;
};

const getResponseDurationMs = (response: any): number => {
    const startMs =
        toValidTimestamp(response.startedAt) ??
        toValidTimestamp(response.createdAt) ??
        toValidTimestamp(response.timestamp);
    if (startMs === null) return 0;

    const endMs =
        toValidTimestamp(response.completedAt) ??
        toValidTimestamp(response.statusUpdatedAt) ??
        toValidTimestamp(response.lastActivityAt) ??
        toValidTimestamp(response.updatedAt) ??
        toValidTimestamp(response.timestamp) ??
        toValidTimestamp(response.createdAt) ??
        toValidTimestamp(response.startedAt) ??
        startMs;

    return Math.max(0, endMs - startMs);
};

const formatDurationMs = (ms: number): string => {
    const safeMs = Math.max(0, ms || 0);
    const totalSeconds = Math.floor(safeMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
};

const formatTableCellValue = (value: unknown): string | null => {
    if (value === undefined || value === null || value === '' || value === '-') return null;
    if (Array.isArray(value)) {
        const compact = value
            .map((entry) => {
                if (entry && typeof entry === 'object') {
                    const record = entry as Record<string, unknown>;
                    const flagCode = typeof record.flagCode === 'string' ? record.flagCode : null;
                    const severity = typeof record.severity === 'string' ? record.severity : null;
                    if (flagCode && severity) return `${flagCode} (${severity})`;
                    try {
                        return JSON.stringify(record);
                    } catch {
                        return String(entry);
                    }
                }
                return String(entry);
            })
            .filter(Boolean);
        return compact.length > 0 ? compact.join(', ') : null;
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const getRespondentExternalId = (response: Record<string, unknown>): string | null => {
    const externalId = formatTableCellValue(
        response.respondentExternalId ??
        response["external RespondentId"] ??
        response.externalRespondentId
    );
    const publicId = formatTableCellValue(
        response.respondentId ??
        response["public respondent ID"]
    );

    if (!externalId || externalId === publicId) return null;
    return externalId;
};

export default function SurveyMetricsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [survey, setSurvey] = useState<Survey | null>(null);
    const [metrics, setMetrics] = useState<MetricData[]>([]);
    const [responses, setResponses] = useState<any[]>([]);
    const [orderedHeaders, setOrderedHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [responsesLoading, setResponsesLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'LIVE' | 'TEST'>('LIVE');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuotaOpen, setIsQuotaOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isSecureShareOpen, setIsSecureShareOpen] = useState(false);
    const [secureShareMode, setSecureShareMode] = useState<"EXPORT" | "DASHBOARD">("EXPORT");
    const [isReconcileOpen, setIsReconcileOpen] = useState(false);
    const [resyncing, setResyncing] = useState(false);
    const [userScopes, setUserScopes] = useState<string[]>([]);
    const [shareEmail, setShareEmail] = useState("");
    const [shareFormat, setShareFormat] = useState<SharedExportFormat>("csv");
    const [shareMode, setShareMode] = useState<SharedExportMode>("LIVE");
    const [sendShareEmail, setSendShareEmail] = useState(true);
    const [shareBusy, setShareBusy] = useState(false);
    const [lastShareUrl, setLastShareUrl] = useState<string | null>(null);
    const [dashboardShareEmail, setDashboardShareEmail] = useState("");
    const [sendDashboardShareEmail, setSendDashboardShareEmail] = useState(true);
    const [dashboardShareBusy, setDashboardShareBusy] = useState(false);
    const [lastDashboardShareUrl, setLastDashboardShareUrl] = useState<string | null>(null);

    // Pagination State
    // Pagination & Search State
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const modeFilter = filters["mode"] || "";
    const respondentIdFilter = filters["respondentId"] || "";
    const statusFilter = filters["status"] || "";
    const itemsPerPage = 10;
    const [feedMeta, setFeedMeta] = useState({
        page: 1,
        limit: itemsPerPage,
        total: 0,
        totalPages: 1,
    });
    const fetchRunRef = useRef(0);
    const responsesFetchRunRef = useRef(0);
    const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        const runId = fetchRunRef.current + 1;
        fetchRunRef.current = runId;
        setLoading(true);
        setFetchError(null);
        try {

            const [surveyData, metricsData] = await Promise.all([
                surveyApi.getSurvey(id, { signal }),
                surveyResponseApi.getMetrics(id, { signal })
            ])
            if (signal?.aborted || fetchRunRef.current !== runId) return;

            if (!surveyData) {
                toast.error("No survey found for this id");
                return;
            }
            setSurvey(surveyData);

            if (metricsData?.modes) {
                setMetrics(metricsData.modes);
            }

            setLoading(false);
            setResponsesLoading(true);
            const selectedMode = modeFilter === "LIVE" || modeFilter === "TEST"
                ? (modeFilter as "LIVE" | "TEST")
                : viewMode;
            const responsesData = await surveyResponseApi.getResponses(id, selectedMode, {
                signal,
                page: currentPage,
                limit: itemsPerPage,
                respondentId: respondentIdFilter || undefined,
                status: statusFilter || undefined,
            });
            if (signal?.aborted || fetchRunRef.current !== runId) return;

            const rData = responsesData.data || [];
            const orderedHeadersFromResponse = responsesData.meta?.orderedHeaders || [];
            // Inject duration calculation for frontend display
            const enrichedResponses = rData.map((r: any) => {
                const durationMs = getResponseDurationMs(r);
                return { ...r, duration: formatDurationMs(durationMs) };
            });

            setResponses(enrichedResponses);
            setOrderedHeaders(orderedHeadersFromResponse);
            setFeedMeta({
                page: responsesData.meta.page,
                limit: responsesData.meta.limit,
                total: responsesData.meta.total,
                totalPages: responsesData.meta.totalPages,
            });
        } catch (error) {
            if (signal?.aborted || fetchRunRef.current !== runId) return;
            console.error("Failed to fetch dashboard data:", error);
            const message = toUserMessage(error, "Failed to load metrics");
            setFetchError(message);
            toast.error(message);
        } finally {
            if (!signal?.aborted && fetchRunRef.current === runId) {
                setLoading(false);
                setResponsesLoading(false);
            }
        }
    }, [currentPage, id, modeFilter, respondentIdFilter, statusFilter, viewMode]);

    const fetchResponsesOnly = useCallback(async (signal?: AbortSignal) => {
        const runId = responsesFetchRunRef.current + 1;
        responsesFetchRunRef.current = runId;
        setResponsesLoading(true);
        try {
            const selectedMode = modeFilter === "LIVE" || modeFilter === "TEST"
                ? (modeFilter as "LIVE" | "TEST")
                : viewMode;
            const responsesData = await surveyResponseApi.getResponses(id, selectedMode, {
                signal,
                page: currentPage,
                limit: itemsPerPage,
                respondentId: respondentIdFilter || undefined,
                status: statusFilter || undefined,
            });
            if (signal?.aborted || responsesFetchRunRef.current !== runId) return;

            const enrichedResponses = (responsesData.data || []).map((r: any) => {
                const durationMs = getResponseDurationMs(r);
                return { ...r, duration: formatDurationMs(durationMs) };
            });

            setResponses(enrichedResponses);
            setOrderedHeaders(responsesData.meta?.orderedHeaders || []);
            setFeedMeta({
                page: responsesData.meta.page,
                limit: responsesData.meta.limit,
                total: responsesData.meta.total,
                totalPages: responsesData.meta.totalPages,
            });
        } catch (error) {
            if (signal?.aborted || responsesFetchRunRef.current !== runId) return;
            console.warn("Failed to refresh realtime response feed:", error);
        } finally {
            if (!signal?.aborted && responsesFetchRunRef.current === runId) {
                setResponsesLoading(false);
            }
        }
    }, [currentPage, id, modeFilter, respondentIdFilter, statusFilter, viewMode]);

    const applyRealtimeMetricsUpdate = useCallback((payload: MetricsRealtimePayload) => {
        setMetrics((current) => {
            const nextMetric: MetricData = {
                mode: payload.mode,
                ...payload.metrics,
            };
            const index = current.findIndex((metric) => metric.mode === payload.mode);
            if (index === -1) return [...current, nextMetric];

            const next = [...current];
            next[index] = {
                ...current[index]!,
                ...nextMetric,
            };
            return next;
        });
    }, []);

    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        setUserScopes(getStoredUserScopes());
        fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData, id]);

    useEffect(() => {
        if (!id) return;

        let stopped = false;
        let activeController: AbortController | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            activeController = new AbortController();
            void surveyResponseApi.subscribeToMetricsUpdates(id, {
                signal: activeController.signal,
                onMetricsUpdated: (payload) => {
                    if (payload.surveyId !== id) return;
                    applyRealtimeMetricsUpdate(payload);

                    const selectedMode = modeFilter === "LIVE" || modeFilter === "TEST"
                        ? modeFilter
                        : viewMode;
                    if (currentPage === 1 && payload.mode === selectedMode) {
                        if (realtimeRefreshTimerRef.current) {
                            clearTimeout(realtimeRefreshTimerRef.current);
                        }
                        realtimeRefreshTimerRef.current = setTimeout(() => {
                            void fetchResponsesOnly();
                        }, 600);
                    }
                },
            }).catch((error) => {
                if (stopped || activeController?.signal.aborted) return;
                console.warn("Metrics stream disconnected. Reconnecting...", error);
                reconnectTimer = setTimeout(connect, 3000);
            });
        };

        connect();

        return () => {
            stopped = true;
            activeController?.abort();
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (realtimeRefreshTimerRef.current) {
                clearTimeout(realtimeRefreshTimerRef.current);
                realtimeRefreshTimerRef.current = null;
            }
        };
    }, [applyRealtimeMetricsUpdate, currentPage, fetchResponsesOnly, id, modeFilter, viewMode]);

    const canManageSurvey = hasPermission(userScopes, PERMISSIONS.SURVEY_EDIT);
    const canManageQuotas = hasPermission(userScopes, PERMISSIONS.QUOTA_MANAGE);
    const canExport = hasPermission(userScopes, PERMISSIONS.RESPONSE_EXPORT);
    const canShareResponses = hasPermission(userScopes, PERMISSIONS.RESPONSE_SHARE);
    const canResync = hasPermission(userScopes, PERMISSIONS.RESPONSE_RESYNC);

    const copyGeneratedLink = async (url: string) => {
        if (typeof navigator === "undefined" || !navigator.clipboard) return false;
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch {
            return false;
        }
    };

    const handleCreateSharedExport = async () => {
        const recipientEmail = shareEmail.trim();
        if (!id || !recipientEmail || shareBusy) return;

        try {
            setShareBusy(true);
            const result = await sharedExportApi.create({
                surveyId: id,
                recipientEmail,
                format: shareFormat,
                mode: shareMode,
                sendEmail: sendShareEmail,
            });
            const url = result.shareUrl || result.url || null;
            setLastShareUrl(url);
            const copied = url ? await copyGeneratedLink(url) : false;
            if (sendShareEmail && result.emailSent === false) {
                toast.warning(copied
                    ? "Secure export link generated and copied, but email delivery failed."
                    : "Secure export link generated, but email delivery failed.");
            } else {
                toast.success(copied ? "Secure export link generated and copied." : "Secure export link generated.");
            }
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to generate secure export link"));
        } finally {
            setShareBusy(false);
        }
    };

    const handleCreateSharedDashboard = async () => {
        const recipientEmail = dashboardShareEmail.trim();
        if (!id || !recipientEmail || dashboardShareBusy) return;

        try {
            setDashboardShareBusy(true);
            const result = await sharedDashboardApi.create({
                surveyId: id,
                recipientEmail,
                sendEmail: sendDashboardShareEmail,
            });
            const url = result.shareUrl || result.url || null;
            setLastDashboardShareUrl(url);
            const copied = url ? await copyGeneratedLink(url) : false;
            if (sendDashboardShareEmail && result.emailSent === false) {
                toast.warning(copied
                    ? "Secure dashboard link generated and copied, but email delivery failed."
                    : "Secure dashboard link generated, but email delivery failed.");
            } else {
                toast.success(copied ? "Secure dashboard link generated and copied." : "Secure dashboard link generated.");
            }
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to generate secure dashboard link"));
        } finally {
            setDashboardShareBusy(false);
        }
    };

    const handleForceResync = async () => {
        if (!id || resyncing) return;
        try {
            setResyncing(true);
            const accepted = await surveyResponseApi.forceResync(id, { full: false, limit: 300, async: true });
            toast.info("Resync started. Waiting for completion...");

            const finalOperation = await operationsApi.waitForOperation(accepted.operationId, {
                timeoutMs: 180000,
                intervalMs: 2000,
            });
            if (finalOperation.status === "SUCCEEDED") {
                const payload = (finalOperation.resultPayload || {}) as any;
                if (payload.success === false) {
                    if (payload.reason === "resync_already_running") {
                        toast.info("A resync is already running. Showing latest available data.");
                    } else {
                        toast.warning(`Resync finished with issues: ${payload.reason || "unknown reason"}`);
                    }
                } else {
                    toast.success(`Resync complete: applied ${payload.applied || 0}, skipped ${payload.skipped || 0}, failed ${payload.failed || 0}`);
                }
            } else {
                toast.warning(`Resync finished with issues: ${finalOperation.errorDetail || "unknown reason"}`);
            }
            await fetchData();
        } catch (error: any) {
            if (error?.code === "OPERATION_TIMEOUT") {
                try {
                    const statusData = await surveyResponseApi.getResyncStatus(id);
                    const currentStatus = statusData?.status?.status;
                    if (currentStatus === "running" || currentStatus === "queued") {
                        toast.warning("Resync is still running in background. Latest metrics have been refreshed.");
                    } else if (currentStatus === "completed") {
                        toast.success("Resync completed in background.");
                    } else if (currentStatus === "failed") {
                        toast.warning(`Resync failed in background: ${statusData?.status?.reason || "unknown reason"}`);
                    } else {
                        toast.warning("Resync is still processing in background.");
                    }
                } catch {
                    toast.warning("Resync is still running in background. Check status again in a few seconds.");
                }
                await fetchData();
                return;
            }
            toast.error(toUserMessage(error, "Failed to resync survey data"));
        } finally {
            setResyncing(false);
        }
    };

    const activeMetrics = metrics.find(m => m.mode === viewMode) || {
        mode: viewMode,
        views: 0, starts: 0, completes: 0, dropped: 0, disqualified: 0,
        overQuota: 0, qualityTerminate: 0, securityTerminate: 0, ir: 0, avgTime: 0
    };

    const totalMetrics = activeMetrics; // For backward compatibility with variable names below

    const screenedCount =
        totalMetrics.completes +
        totalMetrics.disqualified +
        totalMetrics.overQuota +
        totalMetrics.securityTerminate;
    const totalIR = totalMetrics.ir > 0 ? totalMetrics.ir : (
        screenedCount > 0 ? (totalMetrics.completes / screenedCount) * 100 : 0
    );

    // Average time is calculated only from COMPLETED respondents
    const completedResponses = responses.filter(r => String(r.status || '').toUpperCase() === 'COMPLETED');
    const avgTimeMs = completedResponses.length > 0
        ? completedResponses.reduce((acc, curr) => {
            const duration = getResponseDurationMs(curr);
            return acc + Math.max(0, duration);
        }, 0) / completedResponses.length
        : 0;

    const formatTime = (ms: number) => {
        if (ms <= 0) return "0s";
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    // Fix: If views is 0, Total Traffic should at least be the sum of all terminal states
    const safeTotalTraffic = Math.max(
        totalMetrics.views || 0,
        totalMetrics.completes + totalMetrics.dropped + totalMetrics.disqualified + totalMetrics.overQuota + totalMetrics.securityTerminate
    );



    // Fix: Mode Distribution should use total responses per mode if views is missing
    const getModeTotal = (mode: string) => {
        const m = metrics.find(met => met.mode === mode);
        if (!m) return 0;
        return Math.max(m.views || 0, m.completes + m.dropped + m.disqualified + m.overQuota + m.securityTerminate);
    };

    const modeData = [
        { name: 'Live', value: getModeTotal('LIVE') },
        { name: 'Test', value: getModeTotal('TEST') }
    ];

    const chartData = [
        { name: 'Completed', value: totalMetrics.completes, color: '#10b981' },
        { name: 'Disqualified', value: totalMetrics.disqualified, color: '#f59e0b' },
        { name: 'Over Quota', value: totalMetrics.overQuota, color: '#f43f5e' },
        { name: 'Security Term.', value: totalMetrics.securityTerminate, color: '#6366f1' },
        { name: 'Dropped', value: totalMetrics.dropped, color: '#ef4444' },
    ];

    // Dynamic Columns Identification from Ordered Headers
    // Filter out standard columns that we handle statically
    const standardHeaders = [
        'Respondent ID',
        'external RespondentId',
        'public respondent ID',
        'Date',
        'Status',
        'Outcome',
        'Duration',
        'duration',
        'durationMs',
        'duration_ms',
        'completedAt',
        'statusUpdatedAt',
        'lastActivityAt',
        'completed_at',
        'status_updated_at',
        'last_activity_at',
        'id',
        'mode',
        'updatedAt',
        'createdAt',
        'respondentId',
        'respondentExternalId',
        'respondentPublicId',
        'externalRespondentId',
        'status',
        'outcome',
        'Response ID',
        'Submitted At',
        'Version',
        'Survey Name',
        'activeQualityFlags',
        'qualityScore',
        'qualityState',
        'qualityProcessingStatus',
        'qualityReviewStatus',
        'qualityReviewReasonCode',
        'qualityScoreVersion',
        'qualityCriticalOverride',
        'quality_flag_count',
        'quality_flags',
        'quality_flag_severities',
        'quality_review_status',
        'quality_review_reason',
        'quality_processing_status',
        'quality_score',
        'quality_score_version'
    ];
    const normalizedStandardHeaders = new Set(standardHeaders.map(h => h.trim().toLowerCase()));
    const isStandardHeader = (header: string) => normalizedStandardHeaders.has(header.trim().toLowerCase());
    const dynamicHeaders = orderedHeaders.filter(h => !isStandardHeader(h));

    // Fallback if orderedHeaders is missing
    const finalDynamicHeaders = dynamicHeaders.length > 0 ? dynamicHeaders : Array.from(new Set(
        responses.flatMap(r => Object.keys(r))
    )).filter(k => !isStandardHeader(k)).sort();

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        setCurrentPage(1);
    };




    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground font-medium">Analyzing data...</p>
            </div>
        </div>
    );

    if (!survey && fetchError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Could not load metrics</h2>
                    <p className="text-sm text-muted-foreground">{fetchError}</p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchData()}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 rounded-md border border-border text-sm font-medium"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 md:p-12 w-full max-w-7xl mx-auto space-y-8">
            {/* Header: identity + actions, with section tabs woven into the divider */}
            <header className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground truncate">{survey?.name}</h1>
                        <p className="mt-2 text-sm text-muted-foreground font-medium">{survey?.client} • Performance Overview</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchData()}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
                            title="Refresh Data"
                        >
                            <IconRefresh size={16} strokeWidth={1.7} />
                        </button>

                    {!canExport && <button disabled className="px-4 py-2 text-sm border border-border/60 rounded-md opacity-40 cursor-not-allowed" title="Requires permission: survey_studio:response.export"><IconDownload size={18} className="inline mr-2" />Export Data</button>}
                        {canExport && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsExportOpen(!isExportOpen)}
                                    className={cn(
                                        "flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-medium shadow-sm transition-all",
                                        isExportOpen ? "border-primary/40 bg-primary/15 text-primary" : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                                    )}
                                >
                                    <IconDownload size={16} strokeWidth={1.7} />
                                    Export Data
                                </button>

                            {isExportOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsExportOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-background border border-border/60 shadow-lg rounded-md p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => {
                                                surveyResponseApi.exportResponses(id, 'csv');
                                                setIsExportOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                        >
                                            <IconTable size={16} className="text-muted-foreground" />
                                            Export CSV
                                        </button>
                                        <button
                                            onClick={() => {
                                                surveyResponseApi.exportResponses(id, 'xlsx');
                                                setIsExportOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                        >
                                            <IconTable size={16} className="text-muted-foreground" />
                                            Export Excel
                                        </button>
                                        <button
                                            onClick={() => {
                                                surveyResponseApi.exportResponses(id, 'spss');
                                                setIsExportOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                        >
                                            <IconTable size={16} className="text-muted-foreground" />
                                            Export SPSS
                                        </button>
                                    </div>
                                </>
                            )}
                            </div>
                        )}

                        {(canShareResponses || canManageSurvey || canManageQuotas || canResync) && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                                    className={cn(
                                        "flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors",
                                        isMoreOpen && "bg-muted text-foreground"
                                    )}
                                    title="More actions"
                                >
                                    <IconDotsVertical size={16} strokeWidth={1.7} />
                                </button>

                                {isMoreOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsMoreOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-52 bg-background border border-border/60 shadow-lg rounded-md p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                            {canShareResponses && (
                                                <button
                                                    onClick={() => {
                                                        setSecureShareMode("EXPORT");
                                                        setIsSecureShareOpen(true);
                                                        setIsMoreOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                                >
                                                    <IconShare size={16} className="text-muted-foreground" />
                                                    Secure Share
                                                </button>
                                            )}
                                            {canManageSurvey && (
                                                <button
                                                    onClick={() => {
                                                        setIsSettingsOpen(true);
                                                        setIsMoreOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                                >
                                                    <IconSettings size={16} className="text-muted-foreground" />
                                                    Settings
                                                </button>
                                            )}
                                            {canManageQuotas && (
                                                <button
                                                    onClick={() => {
                                                        setIsQuotaOpen(true);
                                                        setIsMoreOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
                                                >
                                                    <IconFilter size={16} className="text-muted-foreground" />
                                                    Quotas
                                                </button>
                                            )}
                                            {canResync && (
                                                <>
                                                    <div className="my-1 border-t border-border/60" />
                                                    <button
                                                        onClick={() => {
                                                            setIsReconcileOpen(true);
                                                            setIsMoreOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-amber-500/10 transition-colors flex items-center gap-2 text-amber-600"
                                                    >
                                                        <IconCheck size={16} />
                                                        Reconcile
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsMoreOpen(false);
                                                            handleForceResync();
                                                        }}
                                                        disabled={resyncing}
                                                        className="w-full text-left px-3 py-2 text-sm font-medium rounded-sm hover:bg-sky-500/10 transition-colors flex items-center gap-2 text-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <IconRefresh size={16} />
                                                        {resyncing ? "Resyncing..." : "Force Resync"}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Section navigation */}
                <SurveyNavTabs surveyId={id} variant="underline" />
            </header>

            {/* Data scope */}
            <div className="flex h-10 w-fit items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                <button
                    onClick={() => setViewMode('LIVE')}
                    className={cn(
                        "h-8 rounded-md px-5 text-xs font-semibold transition-all",
                        viewMode === 'LIVE' ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                    )}
                >
                    Live Data
                </button>
                <button
                    onClick={() => setViewMode('TEST')}
                    className={cn(
                        "h-8 rounded-md px-5 text-xs font-semibold transition-all",
                        viewMode === 'TEST' ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                    )}
                >
                    Test Data
                </button>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <MetricCard
                    title="Total Traffic"
                    value={safeTotalTraffic}
                    icon={<IconClick size={24} />}
                    color="bg-blue-500"
                />
                <MetricCard
                    title="Completions"
                    value={totalMetrics.completes}
                    icon={<IconCheck size={24} />}
                    color="bg-emerald-500"
                />
                <MetricCard
                    title="Conversion Rate"
                    value={`${safeTotalTraffic > 0 ? ((totalMetrics.completes / safeTotalTraffic) * 100).toFixed(1) : 0}%`}
                    icon={<IconChartBar size={24} />}
                    color="bg-indigo-500"
                />
                <MetricCard
                    title="Incidence Rate (IR)"
                    value={`${totalIR.toFixed(1)}%`}
                    icon={<IconChartBar size={24} />}
                    color="bg-amber-500"
                />
                <MetricCard
                    title="Avg Time"
                    value={formatTime(avgTimeMs)}
                    icon={<IconClock size={24} />}
                    color="bg-slate-600"
                />
            </div>

            {/* Secondary Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <MiniMetricCard title="Dropped" value={totalMetrics.dropped} color="text-rose-600" />
                <MiniMetricCard title="Disqualified" value={totalMetrics.disqualified} color="text-amber-600" />
                <MiniMetricCard title="Over Quota" value={totalMetrics.overQuota} color="text-fuchsia-600" />
                <MiniMetricCard title="Security Term." value={totalMetrics.securityTerminate} color="text-slate-700" />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Breakdown Bar Chart */}
                <div className="lg:col-span-2 min-w-0 bg-background border border-border/60 rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-6 flex items-center gap-2 text-foreground">
                        <IconChartBar size={18} className="text-muted-foreground" />
                        Conversion Funnel
                    </h3>
                    <div className="h-[300px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={100}
                                    style={{ fontSize: '12px', fontWeight: 500 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Mode Breakdown Pie Chart */}
                <div className="min-w-0 bg-background border border-border/60 rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-semibold mb-6 flex items-center gap-2 text-foreground">
                        <IconClock size={18} className="text-muted-foreground" />
                        Mode Distribution
                    </h3>
                    <div className="space-y-4">
                        <div className="h-[240px] w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                    <Pie
                                        data={modeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        <Cell fill="#10b981" />
                                        <Cell fill="#6366f1" />
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-center gap-6 pt-1">
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" /> Live
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <div className="w-3 h-3 rounded-full bg-indigo-500" /> Test
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Responses Table */}
            <div className="bg-background border border-border/60 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <IconTable size={18} className="text-muted-foreground" />
                        Data Feed
                    </h3>
                </div>
                {responsesLoading && responses.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground bg-muted/10">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        Loading records...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-muted/30 text-muted-foreground text-xs font-medium">
                                    <th className="px-6 py-3 border-b border-border/60 z-20 min-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <span>Respondent ID</span>
                                            <FilterPopover
                                                value={filters['respondentId'] || ''}
                                                onChange={(v) => handleFilterChange('respondentId', v)}
                                                type="text"
                                                placeholder="Search ID..."
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <span>Status / Outcome</span>
                                            <FilterPopover
                                                value={filters['status'] || ''}
                                                onChange={(v) => handleFilterChange('status', v)}
                                                type="select"
                                                options={[
                                                    { label: 'All', value: '' },
                                                    { label: 'Completed', value: 'COMPLETED' },
                                                    { label: 'Dropped', value: 'DROPPED' },
                                                    { label: 'Disqualified', value: 'DISQUALIFIED' },
                                                    { label: 'Quality Terminate', value: 'QUALITY_TERMINATE' },
                                                    { label: 'Security Terminate', value: 'SECURITY_TERMINATE' },
                                                    { label: 'Over Quota', value: 'OVER_QUOTA' },
                                                    { label: 'In Progress', value: 'IN_PROGRESS' },
                                                ]}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[100px]">
                                        <div className="flex items-center gap-2">
                                            <span>Mode</span>
                                            <FilterPopover
                                                value={filters['mode'] || ''}
                                                onChange={(v) => handleFilterChange('mode', v)}
                                                type="select"
                                                options={[
                                                    { label: 'All', value: '' },
                                                    { label: 'Live', value: 'LIVE' },
                                                    { label: 'Test', value: 'TEST' },
                                                ]}
                                            />
                                        </div>
                                    </th>
                                    {finalDynamicHeaders.map((header: string) => (
                                        <th key={header} className="px-6 py-3 border-b border-border/60 min-w-[200px]">
                                            <div className="flex flex-col gap-2">
                                                <span className="truncate max-w-[180px]" title={header}>{header}</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[100px]">Duration</th>
                                    <th className="px-6 py-3 border-b border-border/60">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {responses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5 + finalDynamicHeaders.length} className="px-6 py-12 text-center text-muted-foreground text-sm">
                                            No records intercepted.
                                        </td>
                                    </tr>
                                ) : (
                                    responses.map((resp, idx) => {
                                        const externalRespondentId = getRespondentExternalId(resp);

                                        return (
                                            <tr key={`${resp.id || "resp"}-${idx}`} className="hover:bg-primary/5 transition-colors group">
                                                <td className="px-6 py-3 border-b border-border/60 border-l-2 group-hover:border-primary transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{resp.respondentId || "Anonymous"}</span>
                                                        {externalRespondentId && (
                                                            <span className="text-xs text-muted-foreground opacity-80 font-mono">{externalRespondentId}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <div className="flex flex-col gap-1">
                                                    <StatusBadge status={resp.status} />
                                                    {resp.outcome && (
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={resp.outcome}>
                                                            {resp.outcome}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-sm text-xs font-medium border",
                                                    resp.mode === 'LIVE' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-blue-50 text-blue-600 border-blue-200"
                                                )}>
                                                    {resp.mode}
                                                </span>
                                            </td>
                                            {finalDynamicHeaders.map((header: string) => {
                                                const displayValue = formatTableCellValue(resp[header]);

                                                return (
                                                    <td key={header} className="px-6 py-3 border-b border-border/60">
                                                        <div className="text-sm text-foreground line-clamp-2" title={displayValue || ''}>
                                                            {displayValue ? (
                                                                displayValue
                                                            ) : (
                                                                <span className="text-muted-foreground opacity-50 block">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-3 border-b border-border/60 text-sm text-muted-foreground">
                                                {resp.duration}
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm text-muted-foreground whitespace-nowrap">
                                                {safeDateTime(resp.createdAt)}
                                            </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {feedMeta.totalPages > 1 && (
                    <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Showing <span className="font-bold text-foreground">{feedMeta.total > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, feedMeta.total)}</span> of <span className="font-bold text-foreground">{feedMeta.total}</span> responses
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                title="Left Icon"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(feedMeta.totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={cn(
                                            "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                            currentPage === i + 1
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(Math.max(0, currentPage - 3), Math.min(feedMeta.totalPages, currentPage + 2))}
                            </div>
                            <button
                                title="Right Icon"
                                onClick={() => setCurrentPage(p => Math.min(feedMeta.totalPages, p + 1))}
                                disabled={currentPage === feedMeta.totalPages}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isSecureShareOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[120] h-dvh w-screen flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <button
                            className="absolute inset-0 cursor-default"
                            onClick={() => setIsSecureShareOpen(false)}
                            aria-label="Close secure share modal"
                        />
                        <div className="relative w-full max-w-xl bg-background border border-border/70 rounded-xl shadow-2xl overflow-hidden">
                            <div className="px-6 py-5 border-b border-border/60 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-lg border",
                                        secureShareMode === "EXPORT"
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                            : "bg-sky-50 text-sky-600 border-sky-200"
                                    )}>
                                        {secureShareMode === "EXPORT" ? (
                                            <IconMailForward size={20} strokeWidth={1.8} />
                                        ) : (
                                            <IconLayoutDashboard size={20} strokeWidth={1.8} />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">Secure Sharing</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Recipient-bound links with email OTP verification.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    title="Close"
                                    onClick={() => setIsSecureShareOpen(false)}
                                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/20 p-1">
                                    <button
                                        onClick={() => setSecureShareMode("EXPORT")}
                                        className={cn(
                                            "h-10 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                            secureShareMode === "EXPORT"
                                                ? "bg-background text-foreground shadow-sm border border-border/70"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <IconMailForward size={16} strokeWidth={1.8} />
                                        Channel Export
                                    </button>
                                    <button
                                        onClick={() => setSecureShareMode("DASHBOARD")}
                                        className={cn(
                                            "h-10 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                            secureShareMode === "DASHBOARD"
                                                ? "bg-background text-foreground shadow-sm border border-border/70"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <IconLayoutDashboard size={16} strokeWidth={1.8} />
                                        Client Dashboard
                                    </button>
                                </div>

                                <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
                                    <div className="mb-4">
                                        <h4 className="text-sm font-semibold text-foreground">
                                            {secureShareMode === "EXPORT" ? "Secure Channel Export" : "Secure Client Dashboard"}
                                        </h4>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {secureShareMode === "EXPORT"
                                                ? "Generate a single-use response export for one authorized recipient."
                                                : "Generate a live client-facing dashboard link for one authorized recipient."}
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                                                {secureShareMode === "EXPORT" ? "Recipient email" : "Client email"}
                                            </span>
                                            <input
                                                type="email"
                                                placeholder={secureShareMode === "EXPORT" ? "recipient@work.com" : "client@work.com"}
                                                value={secureShareMode === "EXPORT" ? shareEmail : dashboardShareEmail}
                                                onChange={(event) => {
                                                    if (secureShareMode === "EXPORT") {
                                                        setShareEmail(event.target.value);
                                                    } else {
                                                        setDashboardShareEmail(event.target.value);
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full h-11 rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition focus:ring-2",
                                                    secureShareMode === "EXPORT"
                                                        ? "focus:border-emerald-500 focus:ring-emerald-500/15"
                                                        : "focus:border-sky-500 focus:ring-sky-500/15"
                                                )}
                                            />
                                        </label>

                                        {secureShareMode === "EXPORT" && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <label className="block">
                                                    <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Format</span>
                                                    <select
                                                        value={shareFormat}
                                                        onChange={(event) => setShareFormat(event.target.value as SharedExportFormat)}
                                                        className="w-full h-11 rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                                                    >
                                                        <option value="csv">CSV Format</option>
                                                        <option value="xlsx">XLSX Format</option>
                                                        <option value="spss">SPSS Format</option>
                                                        <option value="json">JSON Format</option>
                                                    </select>
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dataset</span>
                                                    <select
                                                        value={shareMode}
                                                        onChange={(event) => setShareMode(event.target.value as SharedExportMode)}
                                                        className="w-full h-11 rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                                                    >
                                                        <option value="LIVE">Live Data</option>
                                                        <option value="TEST">Test Data</option>
                                                    </select>
                                                </label>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
                                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={secureShareMode === "EXPORT" ? sendShareEmail : sendDashboardShareEmail}
                                                    onChange={(event) => {
                                                        if (secureShareMode === "EXPORT") {
                                                            setSendShareEmail(event.target.checked);
                                                        } else {
                                                            setSendDashboardShareEmail(event.target.checked);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "h-4 w-4",
                                                        secureShareMode === "EXPORT" ? "accent-emerald-600" : "accent-sky-600"
                                                    )}
                                                />
                                                Auto-dispatch email
                                            </label>
                                            <span className="text-xs text-muted-foreground">
                                                {secureShareMode === "EXPORT" ? "72h TTL" : "Until archive"}
                                            </span>
                                        </div>

                                        <button
                                            onClick={secureShareMode === "EXPORT" ? handleCreateSharedExport : handleCreateSharedDashboard}
                                            disabled={
                                                secureShareMode === "EXPORT"
                                                    ? !shareEmail.trim() || shareBusy
                                                    : !dashboardShareEmail.trim() || dashboardShareBusy
                                            }
                                            className={cn(
                                                "w-full h-11 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                                secureShareMode === "EXPORT"
                                                    ? (!shareEmail.trim() || shareBusy
                                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm")
                                                    : (!dashboardShareEmail.trim() || dashboardShareBusy
                                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                        : "bg-sky-600 text-white hover:bg-sky-700 shadow-sm")
                                            )}
                                        >
                                            <IconLink size={17} strokeWidth={1.8} />
                                            {secureShareMode === "EXPORT"
                                                ? (shareBusy ? "Generating..." : "Generate Access Link")
                                                : (dashboardShareBusy ? "Generating..." : "Generate Dashboard Link")}
                                        </button>

                                        {secureShareMode === "EXPORT" && lastShareUrl && (
                                            <button
                                                onClick={() => void copyGeneratedLink(lastShareUrl).then((copied) => {
                                                    if (copied) toast.success("Link copied.");
                                                    else toast.info("Copy unavailable.");
                                                })}
                                                className="group w-full rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3 text-left hover:bg-emerald-50 transition"
                                                title={lastShareUrl}
                                            >
                                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-700">Generated export link</span>
                                                <span className="block truncate text-xs font-mono text-emerald-900 group-hover:underline">{lastShareUrl}</span>
                                            </button>
                                        )}

                                        {secureShareMode === "DASHBOARD" && lastDashboardShareUrl && (
                                            <button
                                                onClick={() => void copyGeneratedLink(lastDashboardShareUrl).then((copied) => {
                                                    if (copied) toast.success("Link copied.");
                                                    else toast.info("Copy unavailable.");
                                                })}
                                                className="group w-full rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-3 text-left hover:bg-sky-50 transition"
                                                title={lastDashboardShareUrl}
                                            >
                                                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-sky-700">Generated dashboard link</span>
                                                <span className="block truncate text-xs font-mono text-sky-900 group-hover:underline">{lastDashboardShareUrl}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            <SurveySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={id}
            />
            <SurveyQuotaModal
                isOpen={isQuotaOpen}
                onClose={() => setIsQuotaOpen(false)}
                surveyId={id}
            />
            <ReconcileResponseModal
                isOpen={isReconcileOpen}
                onClose={() => setIsReconcileOpen(false)}
                surveyId={id}
                onSuccess={() => {
                    fetchData();
                }}
            />
        </div>
    );
}

function MetricCard({ title, value, icon, color }: { title: string, value: string | number, icon: any, color: string }) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            className="bg-background border border-border/60 rounded-xl p-5 shadow-sm flex items-center gap-4"
        >
            <div className="p-2 text-muted-foreground">
                {icon}
            </div>
            <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{title}</p>
                <h4 className="text-2xl font-bold leading-none text-foreground">{value}</h4>
            </div>
        </motion.div>
    );
}

function MiniMetricCard({ title, value, color }: { title: string, value: string | number, color: string }) {
    return (
        <div className="bg-background border border-border/60 rounded-xl p-4 shadow-sm flex flex-col justify-end min-h-[80px]">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
            <h5 className={cn("text-lg font-bold", color)}>{value}</h5>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    // Map standard colors
    const variants: Record<string, string> = {
        COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-200",
        DROPPED: "bg-rose-50 text-rose-600 border-rose-200",
        DISQUALIFIED: "bg-amber-50 text-amber-600 border-amber-200",
        QUALITY_TERMINATE: "bg-indigo-50 text-indigo-600 border-indigo-200",
        SECURITY_TERMINATE: "bg-zinc-50 text-zinc-600 border-zinc-200",
        OVER_QUOTA: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200",
        IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-200",
    };

    return (
        <span className={cn(
            "px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold border shadow-sm w-fit",
            variants[status] || "bg-muted text-muted-foreground border-border"
        )}>
            {String(status || "UNKNOWN").replace(/_/g, ' ')}
        </span>
    );
}

function FilterPopover({ value, onChange, type, options, placeholder }: {
    value: string,
    onChange: (val: string) => void,
    type: 'text' | 'select',
    options?: { label: string, value: string }[],
    placeholder?: string
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block ml-1">
            <button
                title="Filter Icon"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "p-1.5 rounded-lg hover:bg-muted transition-colors",
                    value ? "text-primary bg-primary/10 ring-1 ring-primary/20" : "text-muted-foreground"
                )}
            >
                <IconFilter size={14} strokeWidth={2.5} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 left-0 mt-2 min-w-[200px] w-max bg-card border border-border shadow-xl rounded-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                        {type === 'select' && options ? (
                            <div className="flex flex-col gap-1">
                                {options.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { onChange(opt.value); setIsOpen(false) }}
                                        className={cn(
                                            "text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-muted",
                                            value === opt.value ? "bg-primary/10 text-primary" : "text-foreground"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={placeholder || "Filter..."}
                                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsOpen(false)}
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="text-[10px] font-bold text-primary uppercase tracking-wide hover:underline"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
