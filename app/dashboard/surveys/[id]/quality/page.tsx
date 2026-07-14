"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    IconAlertCircle,
    IconCheck,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconFlag,
    IconGauge,
    IconInfoCircle,
    IconRefresh,
    IconSettings,
    IconShieldLock,
    IconX,
} from "@tabler/icons-react";
import { surveyApi } from "@/api/survey";
import {
    surveyResponseApi,
    type QualityResponseDetail,
    type QualityResponseFlag,
    type QualityResponseListItem,
    type QualitySummary,
} from "@/api/surveyResponse";
import { getStoredUserRole, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { safeDateTime, safeIdShort } from "@/lib/safe-format";
import { toUserMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { Survey } from "@/src/shared/types/survey";
import type { UserRole } from "@/types/auth";
import { toast } from "sonner";
import { QualitySettingsModal } from "@/components/modals/QualitySettingsModal";
import { ModalPortal } from "@/components/ui/ModalPortal";

const STATE_META: Record<string, { label: string; description: string; badge: string; dot: string }> = {
    CLEAN: {
        label: "Clean",
        description: "No quality issues detected on this response.",
        badge: "bg-emerald-50 text-emerald-600 border-emerald-200",
        dot: "bg-emerald-500",
    },
    WATCHLIST: {
        label: "Watchlist",
        description: "Minor anomalies detected. No action needed yet — just being monitored.",
        badge: "bg-amber-50 text-amber-600 border-amber-200",
        dot: "bg-amber-500",
    },
    FLAGGED: {
        label: "Flagged",
        description: "Quality issues detected. This response needs a reviewer's decision.",
        badge: "bg-rose-50 text-rose-600 border-rose-200",
        dot: "bg-rose-500",
    },
    HIGH_RISK: {
        label: "High Risk",
        description: "Multiple serious flags. This response is likely bad data.",
        badge: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-600",
    },
    UNSCORED: {
        label: "Not Scored",
        description: "This response hasn't been through quality scoring yet.",
        badge: "bg-muted text-muted-foreground border-border",
        dot: "bg-slate-400",
    },
};

const REVIEW_META: Record<string, { label: string; description: string; badge: string }> = {
    UNREVIEWED: {
        label: "Awaiting Review",
        description: "No reviewer has looked at this response yet.",
        badge: "bg-muted text-muted-foreground border-border",
    },
    REVIEWED_VALID: {
        label: "Cleared",
        description: "A reviewer checked the flags and found the response legitimate.",
        badge: "bg-blue-50 text-blue-600 border-blue-200",
    },
    REVIEWED_CONFIRMED: {
        label: "Confirmed Bad",
        description: "A reviewer verified the flags — this response is genuinely low quality.",
        badge: "bg-violet-50 text-violet-600 border-violet-200",
    },
};

const REVIEW_CHOICES: { value: string; label: string; description: string }[] = [
    {
        value: "REVIEWED_VALID",
        label: "Clear this response",
        description: "The flags are wrong or excusable — the answers are legitimate.",
    },
    {
        value: "REVIEWED_CONFIRMED",
        label: "Confirm as bad data",
        description: "The flags are correct — this response is genuinely low quality.",
    },
    {
        value: "UNREVIEWED",
        label: "Reset to unreviewed",
        description: "Undo the previous decision and put it back in the review queue.",
    },
];

const REASON_META: Record<string, string> = {
    FALSE_POSITIVE: "False positive — the detector was wrong",
    VALID_EXCEPTION: "Valid exception — unusual but legitimate",
    CONFIRMED_DUPLICATE: "Confirmed duplicate submission",
    CONFIRMED_LOW_QUALITY: "Confirmed low-quality answers",
    PANEL_RECONCILED: "Reconciled with the panel provider",
    OTHER_SANITIZED: "Other reason (see note)",
};

const DETECTOR_META: Record<string, { label: string; description: string }> = {
    SURVEY_SPEEDER: {
        label: "Survey Speeding",
        description: "Finished the whole survey faster than the minimum expected time.",
    },
    QUESTION_SPEEDER: {
        label: "Question Speeding",
        description: "Answered individual questions too quickly to have read them.",
    },
    STRAIGHT_LINE_BEHAVIOR: {
        label: "Straight-lining",
        description: "Picked the same answer position down a grid of questions.",
    },
    DUPLICATE_PID: {
        label: "Duplicate Panelist",
        description: "The same panelist ID submitted more than one response.",
    },
    DUPLICATE_DEVICE: {
        label: "Duplicate Device",
        description: "The same device fingerprint submitted more than one response.",
    },
};

const SEVERITY_TONE: Record<string, string> = {
    LOW: "bg-muted text-muted-foreground border-border",
    MEDIUM: "bg-amber-50 text-amber-600 border-amber-200",
    HIGH: "bg-rose-50 text-rose-600 border-rose-200",
    CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

const emptySummary: QualitySummary = {
    averageScore: null,
    totalResponses: 0,
    scoredResponses: 0,
    stateCounts: {},
    detectorCounts: {},
    detectorReviewMetrics: {},
};

const stateMeta = (state?: string | null) => STATE_META[state || "UNSCORED"] || STATE_META.UNSCORED!;
const reviewMeta = (status?: string | null) => REVIEW_META[status || "UNREVIEWED"] || REVIEW_META.UNREVIEWED!;
const detectorMeta = (code: string) =>
    DETECTOR_META[code] || { label: titleCase(code), description: "Automated quality check." };

function titleCase(value: string) {
    return value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

const formatPercent = (value: number, total: number) => {
    if (total <= 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
};

const scoreMeaning = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "Not scored yet";
    if (score >= 90) return "Excellent — no meaningful issues";
    if (score >= 70) return "Good — minor anomalies only";
    if (score >= 50) return "Suspect — worth a closer look";
    return "Poor — serious quality problems";
};

const formatEvidenceSummary = (flag: QualityResponseFlag) => {
    const evidence = flag.evidence;
    if (evidence && typeof evidence.summary === "string" && evidence.summary.trim().length > 0) {
        return evidence.summary;
    }
    return detectorMeta(flag.detectorCode).description;
};

const getActiveFlags = (detail: QualityResponseDetail | null) =>
    (detail?.qualityFlags || []).filter((flag) => flag.isActive);

export default function SurveyQualityPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [survey, setSurvey] = useState<Survey | null>(null);
    const [summary, setSummary] = useState<QualitySummary>(emptySummary);
    const [responses, setResponses] = useState<QualityResponseListItem[]>([]);
    const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<QualityResponseDetail | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [savingReview, setSavingReview] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"LIVE" | "TEST">("LIVE");
    const [qualityState, setQualityState] = useState<string>("ALL");
    const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
    const [reviewStatus, setReviewStatus] = useState("REVIEWED_VALID");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [reviewReasonCode, setReviewReasonCode] = useState("");
    const [reviewNote, setReviewNote] = useState("");
    const [reviewedFlagIds, setReviewedFlagIds] = useState<string[]>([]);
    const [userRole, setUserRole] = useState<UserRole | undefined>(undefined);
    const [roleHydrated, setRoleHydrated] = useState(false);

    useEffect(() => {
        setUserRole(getStoredUserRole());
        setRoleHydrated(true);
    }, []);

    const canReadQuality = hasPermission(userRole, PERMISSIONS.SURVEY_QUALITY_READ);
    const canReviewQuality = hasPermission(userRole, PERMISSIONS.SURVEY_QUALITY_REVIEW);
    const canConfigureQuality = hasPermission(userRole, PERMISSIONS.SURVEY_QUALITY_CONFIGURE);

    const openResponse = (responseId: string) => {
        setSelectedResponseId(responseId);
        setIsDrawerOpen(true);
    };

    const closeDrawer = () => {
        setIsDrawerOpen(false);
    };

    useEffect(() => {
        if (!isDrawerOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeDrawer();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isDrawerOpen]);

    const loadSummary = async (mode: "LIVE" | "TEST") => {
        const nextSummary = await surveyResponseApi.getQualitySummary(id, mode);
        setSummary(nextSummary);
    };

    const loadResponses = async (mode: "LIVE" | "TEST", page = 1) => {
        setListLoading(true);
        try {
            const result = await surveyResponseApi.getQualityResponses(id, {
                mode,
                page,
                limit: 25,
                state: qualityState !== "ALL" ? qualityState : undefined,
                reviewStatus: reviewStatusFilter !== "ALL" ? reviewStatusFilter : undefined,
            });
            setResponses(result.data);
            setMeta(result.meta);
        } finally {
            setListLoading(false);
        }
    };

    const loadDetail = async (responseId: string) => {
        setDetailLoading(true);
        try {
            const detail = await surveyResponseApi.getQualityResponseDetail(id, responseId);
            setSelectedDetail(detail);
            const currentStatus = detail.qualityReviewStatus || "UNREVIEWED";
            setReviewStatus(currentStatus === "UNREVIEWED" ? "REVIEWED_VALID" : currentStatus);
            setReviewReasonCode(detail.qualityReviewReasonCode || "");
            setReviewNote("");
            setReviewedFlagIds(getActiveFlags(detail).map((flag) => flag.id));
            setIsReviewOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (!id || !canReadQuality) return;
        let cancelled = false;
        setLoading(true);
        setFetchError(null);
        Promise.all([
            surveyApi.getSurvey(id),
            surveyResponseApi.getQualitySummary(id, viewMode),
            surveyResponseApi.getQualityResponses(id, {
                mode: viewMode,
                page: currentPage,
                limit: 25,
                state: qualityState !== "ALL" ? qualityState : undefined,
                reviewStatus: reviewStatusFilter !== "ALL" ? reviewStatusFilter : undefined,
            }),
        ]).then(([surveyData, summaryData, listData]) => {
            if (cancelled) return;
            setSurvey(surveyData);
            setSummary(summaryData);
            setResponses(listData.data);
            setMeta(listData.meta);
            setLoading(false);
        }).catch((error) => {
            if (cancelled) return;
            const message = toUserMessage(error, "Failed to load quality data");
            setFetchError(message);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [id, canReadQuality, viewMode, currentPage, qualityState, reviewStatusFilter]);

    useEffect(() => {
        if (!selectedResponseId || !isDrawerOpen || !canReadQuality) return;
        void loadDetail(selectedResponseId).catch((error) => {
            setSelectedDetail(null);
            toast.error(toUserMessage(error, "Failed to load response quality detail"));
        });
    }, [selectedResponseId, isDrawerOpen, canReadQuality, id]);

    const detectorRows = useMemo(() => {
        return Object.entries(summary.detectorCounts)
            .map(([detectorCode, count]) => ({
                detectorCode,
                count,
                metrics: summary.detectorReviewMetrics[detectorCode] || {
                    activeCount: count,
                    reviewedValidCount: 0,
                    reviewedConfirmedCount: 0,
                },
            }))
            .sort((a, b) => b.count - a.count);
    }, [summary]);

    const maxDetectorCount = useMemo(
        () => detectorRows.reduce((max, row) => Math.max(max, row.count), 0),
        [detectorRows]
    );

    const activeFlags = useMemo(() => getActiveFlags(selectedDetail), [selectedDetail]);

    const needsReviewCount = (summary.stateCounts.FLAGGED || 0) + (summary.stateCounts.HIGH_RISK || 0);

    const refreshAll = async (page = currentPage, keepDetail = isDrawerOpen ? selectedResponseId : null) => {
        await Promise.all([
            loadSummary(viewMode),
            loadResponses(viewMode, page),
        ]);
        if (keepDetail) {
            await loadDetail(keepDetail);
        }
    };

    const toggleReviewedFlag = (flagId: string) => {
        setReviewedFlagIds((current) => current.includes(flagId)
            ? current.filter((value) => value !== flagId)
            : [...current, flagId]);
    };

    const submitReview = async () => {
        if (!selectedDetail) return;
        if (reviewStatus !== "UNREVIEWED" && activeFlags.length > 1 && reviewedFlagIds.length === 0) {
            toast.error("Select at least one flag this decision applies to.");
            return;
        }
        setSavingReview(true);
        try {
            await surveyResponseApi.reviewQualityResponse(id, selectedDetail.id, {
                reviewStatus,
                reasonCode: reviewStatus === "UNREVIEWED" ? undefined : (reviewReasonCode || undefined),
                note: reviewStatus === "UNREVIEWED" ? undefined : (reviewNote.trim() || undefined),
                reviewedFlagIds: reviewStatus === "UNREVIEWED"
                    ? activeFlags.map((flag) => flag.id)
                    : (activeFlags.length > 1 ? reviewedFlagIds : undefined),
            });
            toast.success("Review saved.");
            await refreshAll(currentPage, selectedDetail.id);
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to save review"));
        } finally {
            setSavingReview(false);
        }
    };

    if (!roleHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground font-medium">Loading quality data...</p>
                </div>
            </div>
        );
    }

    if (!canReadQuality) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-amber-50 text-amber-600 border-amber-200">
                            <IconShieldLock size={20} strokeWidth={1.8} />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">No access to Response Quality</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Your role doesn't include permission to view response quality data. Ask an admin to grant you quality access if you need it.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${id}/metrics`)}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                        >
                            Back to Metrics
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${id}`)}
                            className="px-4 py-2 rounded-md border border-border text-sm font-medium"
                        >
                            Open Builder
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError || !survey) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-rose-50 text-rose-600 border-rose-200">
                            <IconAlertCircle size={20} strokeWidth={1.8} />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">Could not load quality data</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">{fetchError || "Unknown error"}</p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${id}/metrics`)}
                            className="px-4 py-2 rounded-md border border-border text-sm font-medium"
                        >
                            Back to Metrics
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 md:p-12 w-full max-w-7xl mx-auto space-y-8">
            {/* Top Navigation / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">{survey.name}</h1>
                    <div className="mt-2 flex items-center gap-2">
                        <p className="text-sm text-muted-foreground font-medium">{survey.client ? `${survey.client} • ` : ""}Response Quality</p>
                        <HowScoringWorksPopover />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => void refreshAll()}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all border border-transparent hover:border-border/60"
                        title="Refresh Data"
                    >
                        <IconRefresh size={18} strokeWidth={1.5} />
                    </button>

                    {canConfigureQuality && (
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all border border-transparent hover:border-border/60"
                            title="Quality Settings"
                        >
                            <IconSettings size={18} strokeWidth={1.5} />
                        </button>
                    )}

                    <div className="w-px h-6 bg-border/60 mx-1" />

                    <button
                        onClick={() => router.push(`/dashboard/surveys/${id}`)}
                        className="px-4 py-2 text-sm font-medium border border-border/60 rounded-md hover:bg-muted transition-all"
                    >
                        Open Builder
                    </button>
                    <button
                        onClick={() => router.push(`/dashboard/surveys/${id}/metrics`)}
                        className="px-4 py-2 text-sm font-medium border border-border/60 rounded-md hover:bg-muted transition-all"
                    >
                        Metrics
                    </button>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-md w-fit border border-border/60">
                <button
                    onClick={() => {
                        setViewMode("LIVE");
                        setCurrentPage(1);
                    }}
                    className={cn(
                        "px-6 py-1.5 text-xs font-semibold rounded-sm transition-all",
                        viewMode === "LIVE" ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                    )}
                >
                    Live Data
                </button>
                <button
                    onClick={() => {
                        setViewMode("TEST");
                        setCurrentPage(1);
                    }}
                    className={cn(
                        "px-6 py-1.5 text-xs font-semibold rounded-sm transition-all",
                        viewMode === "TEST" ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                    )}
                >
                    Test Data
                </button>
            </div>

            {/* KPI Strip */}
            <div className="bg-background border border-border/60 rounded-xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-border/60 divide-y lg:divide-y-0">
                <KpiCell
                    label="Average Score"
                    hint="Responses start at 100 and lose points for each quality flag. Higher is better."
                    value={summary.averageScore === null ? "—" : summary.averageScore.toFixed(0)}
                    suffix={summary.averageScore === null ? undefined : "/100"}
                    sub={`${summary.scoredResponses} scored`}
                />
                <KpiCell
                    label="Needs Review"
                    hint="Flagged and high-risk responses waiting for a reviewer to clear or confirm them."
                    value={String(needsReviewCount)}
                    sub={formatPercent(needsReviewCount, summary.totalResponses)}
                    valueClassName={needsReviewCount > 0 ? "text-rose-600" : undefined}
                />
                <KpiCell
                    label="Watchlist"
                    hint="Responses with small anomalies that aren't serious enough to flag. Monitored automatically."
                    value={String(summary.stateCounts.WATCHLIST || 0)}
                    sub={formatPercent(summary.stateCounts.WATCHLIST || 0, summary.totalResponses)}
                />
                <KpiCell
                    label="Clean"
                    hint="Responses that passed every quality check with no issues."
                    value={String(summary.stateCounts.CLEAN || 0)}
                    sub={formatPercent(summary.stateCounts.CLEAN || 0, summary.totalResponses)}
                />
            </div>

            {/* Responses Table */}
            <div className="bg-background border border-border/60 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <IconGauge size={18} className="text-muted-foreground" />
                            Responses by Quality
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Lowest scores first. Click a row to see why it was flagged and record a decision.
                        </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {meta.total} responses
                    </span>
                </div>

                {listLoading ? (
                    <div className="p-12 text-center text-muted-foreground bg-muted/10">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        Loading responses...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-muted/30 text-muted-foreground text-xs font-medium">
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[220px]">Respondent</th>
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[160px]">
                                        <div className="flex items-center gap-2">
                                            <span>Score</span>
                                            <FilterPopover
                                                value={qualityState === "ALL" ? "" : qualityState}
                                                onChange={(v) => {
                                                    setQualityState(v || "ALL");
                                                    setCurrentPage(1);
                                                }}
                                                options={[
                                                    { label: "All states", value: "" },
                                                    ...Object.entries(STATE_META).map(([value, m]) => ({ label: m.label, value })),
                                                ]}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 border-b border-border/60">Flags</th>
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <span>Review</span>
                                            <FilterPopover
                                                value={reviewStatusFilter === "ALL" ? "" : reviewStatusFilter}
                                                onChange={(v) => {
                                                    setReviewStatusFilter(v || "ALL");
                                                    setCurrentPage(1);
                                                }}
                                                options={[
                                                    { label: "All statuses", value: "" },
                                                    ...Object.entries(REVIEW_META).map(([value, m]) => ({ label: m.label, value })),
                                                ]}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 border-b border-border/60 whitespace-nowrap">Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {responses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                                            {qualityState !== "ALL" || reviewStatusFilter !== "ALL"
                                                ? "No responses match these filters. Try clearing them."
                                                : "No responses yet — quality scores will appear here as responses come in."}
                                        </td>
                                    </tr>
                                ) : (
                                    responses.map((response) => (
                                        <tr
                                            key={response.id}
                                            onClick={() => openResponse(response.id)}
                                            className={cn(
                                                "cursor-pointer hover:bg-primary/5 transition-colors group",
                                                selectedResponseId === response.id && "bg-primary/5"
                                            )}
                                        >
                                            <td className={cn(
                                                "px-6 py-3 border-b border-border/60 border-l-2 transition-colors",
                                                selectedResponseId === response.id ? "border-l-primary" : "border-l-transparent group-hover:border-l-primary"
                                            )}>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{response.respondentId || "Anonymous"}</span>
                                                    <span className="text-xs text-muted-foreground opacity-80 font-mono">ID-{safeIdShort(response.id)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <div
                                                    className="flex items-center gap-2"
                                                    title={`${stateMeta(response.qualityState).label} — ${stateMeta(response.qualityState).description}`}
                                                >
                                                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", stateMeta(response.qualityState).dot)} />
                                                    <span className="text-sm font-bold text-foreground">
                                                        {response.qualityScore ?? "—"}
                                                    </span>
                                                    {response.qualityScore !== null && response.qualityScore !== undefined && (
                                                        <span className="text-xs text-muted-foreground">/100</span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground hidden xl:inline">· {stateMeta(response.qualityState).label}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm text-foreground whitespace-nowrap">
                                                {response.activeFlagCount > 0
                                                    ? `${response.activeFlagCount} flag${response.activeFlagCount === 1 ? "" : "s"}`
                                                    : <span className="text-muted-foreground opacity-50">—</span>}
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <QualityBadge meta={reviewMeta(response.qualityReviewStatus)} />
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60 text-xs text-muted-foreground whitespace-nowrap">
                                                {safeDateTime(response.qualityReviewedAt || response.completedAt || response.startedAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {meta.totalPages > 1 && (
                    <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Showing <span className="font-bold text-foreground">{meta.total > 0 ? ((meta.page - 1) * meta.limit) + 1 : 0}</span> to <span className="font-bold text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-bold text-foreground">{meta.total}</span> responses
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                title="Previous page"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={meta.page <= 1}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(meta.totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={cn(
                                            "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                            meta.page === i + 1
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(Math.max(0, meta.page - 3), Math.min(meta.totalPages, meta.page + 2))}
                            </div>
                            <button
                                title="Next page"
                                onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                                disabled={meta.page >= meta.totalPages}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detector Breakdown */}
            <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border/60">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <IconFlag size={18} className="text-muted-foreground" />
                        What the checks found
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        How often each automated check fired in {viewMode === "LIVE" ? "live" : "test"} data. Hover a name for what it checks.
                    </p>
                </div>
                {detectorRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No quality flags yet — every scored response passed all checks.
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {detectorRows.map((row) => (
                            <div key={row.detectorCode} className="px-6 py-3 flex items-center gap-4">
                                <span
                                    className="w-44 shrink-0 text-sm font-medium text-foreground cursor-help"
                                    title={detectorMeta(row.detectorCode).description}
                                >
                                    {detectorMeta(row.detectorCode).label}
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-rose-400"
                                        style={{ width: `${maxDetectorCount > 0 ? Math.max(4, (row.count / maxDetectorCount) * 100) : 0}%` }}
                                    />
                                </div>
                                <span className="w-10 shrink-0 text-right text-sm font-bold text-foreground">{row.count}</span>
                                <span className="w-44 shrink-0 text-right text-xs text-muted-foreground whitespace-nowrap">
                                    <span className="font-semibold text-blue-600">{row.metrics.reviewedValidCount}</span> cleared
                                    <span className="mx-1.5 text-border">|</span>
                                    <span className="font-semibold text-violet-600">{row.metrics.reviewedConfirmedCount}</span> confirmed
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Response Detail Drawer */}
            {isDrawerOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[120] h-dvh w-screen">
                        <button
                            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] cursor-default animate-in fade-in duration-200"
                            onClick={closeDrawer}
                            aria-label="Close response detail"
                        />
                        <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-background border-l border-border/70 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                            {/* Drawer header */}
                            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between gap-3 shrink-0">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-foreground truncate">
                                        {selectedDetail?.respondentId || "Response detail"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {selectedDetail ? `ID-${safeIdShort(selectedDetail.id)} · ${selectedDetail.mode === "LIVE" ? "Live Data" : "Test Data"}` : "Loading..."}
                                    </p>
                                </div>
                                <button
                                    title="Close (Esc)"
                                    onClick={closeDrawer}
                                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            {/* Drawer body */}
                            <div className="flex-1 overflow-y-auto">
                                {detailLoading || !selectedDetail ? (
                                    <div className="p-12 text-center text-muted-foreground">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        Loading detail...
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {/* Score summary */}
                                        <div className="px-6 py-5 flex items-center gap-5">
                                            <div className="text-center shrink-0">
                                                <div className="text-4xl font-bold tracking-tight text-foreground leading-none">
                                                    {selectedDetail.qualityScore ?? "—"}
                                                </div>
                                                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">of 100</div>
                                            </div>
                                            <div className="min-w-0 space-y-1.5">
                                                <p className="text-sm font-semibold text-foreground">{scoreMeaning(selectedDetail.qualityScore)}</p>
                                                <p className="text-xs text-muted-foreground">{stateMeta(selectedDetail.qualityState).description}</p>
                                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                                    <QualityBadge meta={stateMeta(selectedDetail.qualityState)} />
                                                    <QualityBadge meta={reviewMeta(selectedDetail.qualityReviewStatus)} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Flags */}
                                        <div className="px-6 py-5 space-y-3">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                {activeFlags.length === 0 ? "Quality flags" : `Quality flags (${activeFlags.length})`}
                                            </h4>
                                            {activeFlags.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">
                                                    No active flags — this response passed all checks.
                                                </p>
                                            ) : (
                                                activeFlags.map((flag) => (
                                                    <div key={flag.id} className="rounded-lg border border-border/60 bg-background p-4">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 space-y-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-sm font-semibold text-foreground">{detectorMeta(flag.detectorCode).label}</span>
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold border w-fit",
                                                                        SEVERITY_TONE[flag.severity] || SEVERITY_TONE.LOW
                                                                    )}>
                                                                        {flag.severity}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground">{formatEvidenceSummary(flag)}</p>
                                                                <p className="text-xs text-muted-foreground opacity-80">Detected {safeDateTime(flag.detectedAt)}</p>
                                                            </div>
                                                            <span
                                                                className="rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600 shrink-0"
                                                                title="Points subtracted from this response's score"
                                                            >
                                                                −{flag.scoreImpact} pts
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Review */}
                                        {activeFlags.length > 0 && (
                                            <div className="px-6 py-5">
                                                <div className="rounded-lg border border-border/60 overflow-hidden">
                                                    <button
                                                        onClick={() => setIsReviewOpen((open) => !open)}
                                                        disabled={!canReviewQuality}
                                                        className={cn(
                                                            "w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                                                            canReviewQuality ? "hover:bg-muted/40" : "cursor-not-allowed opacity-70"
                                                        )}
                                                    >
                                                        <div>
                                                            <span className="text-sm font-semibold text-foreground">Review this response</span>
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {canReviewQuality
                                                                    ? (selectedDetail.qualityReviewStatus && selectedDetail.qualityReviewStatus !== "UNREVIEWED"
                                                                        ? `${reviewMeta(selectedDetail.qualityReviewStatus).label}${selectedDetail.qualityReviewedAt ? ` on ${safeDateTime(selectedDetail.qualityReviewedAt)}` : ""} — you can change this decision.`
                                                                        : "Decide whether these flags are real problems or false alarms.")
                                                                    : "Your role can view quality data but not record review decisions."}
                                                            </p>
                                                        </div>
                                                        <IconChevronDown size={18} className={cn("shrink-0 text-muted-foreground transition-transform", isReviewOpen && "rotate-180")} />
                                                    </button>

                                                    {isReviewOpen && canReviewQuality && (
                                                        <div className="border-t border-border/60 bg-muted/10 p-4 space-y-4">
                                                            <div className="space-y-2">
                                                                {REVIEW_CHOICES.map((choice) => (
                                                                    <label
                                                                        key={choice.value}
                                                                        className={cn(
                                                                            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                                                            reviewStatus === choice.value
                                                                                ? "border-primary/50 bg-primary/5"
                                                                                : "border-border/60 bg-background hover:bg-muted/30"
                                                                        )}
                                                                    >
                                                                        <input
                                                                            type="radio"
                                                                            name="review-decision"
                                                                            value={choice.value}
                                                                            checked={reviewStatus === choice.value}
                                                                            onChange={() => setReviewStatus(choice.value)}
                                                                            className="mt-0.5 h-4 w-4 accent-primary"
                                                                        />
                                                                        <span>
                                                                            <span className="block text-sm font-semibold text-foreground">{choice.label}</span>
                                                                            <span className="block text-xs text-muted-foreground">{choice.description}</span>
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>

                                                            {reviewStatus !== "UNREVIEWED" && activeFlags.length > 1 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-semibold text-muted-foreground">Which flags does this decision apply to?</p>
                                                                    <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
                                                                        {activeFlags.map((flag) => (
                                                                            <label key={flag.id} className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={reviewedFlagIds.includes(flag.id)}
                                                                                    onChange={() => toggleReviewedFlag(flag.id)}
                                                                                    className="mt-0.5 h-4 w-4 accent-primary"
                                                                                />
                                                                                <span>
                                                                                    <span className="font-medium">{detectorMeta(flag.detectorCode).label}</span>
                                                                                    <span className="text-muted-foreground"> — {formatEvidenceSummary(flag)}</span>
                                                                                </span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {reviewStatus !== "UNREVIEWED" && (
                                                                <>
                                                                    <label className="block">
                                                                        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Reason (optional)</span>
                                                                        <select
                                                                            value={reviewReasonCode}
                                                                            onChange={(event) => setReviewReasonCode(event.target.value)}
                                                                            className="w-full h-10 rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                                                        >
                                                                            <option value="">Select a reason...</option>
                                                                            {Object.entries(REASON_META).map(([value, label]) => (
                                                                                <option key={value} value={value}>{label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>

                                                                    <label className="block">
                                                                        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Internal note (optional)</span>
                                                                        <textarea
                                                                            value={reviewNote}
                                                                            onChange={(event) => setReviewNote(event.target.value)}
                                                                            rows={3}
                                                                            placeholder="Visible to your team only. Avoid personal data."
                                                                            className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                                                        />
                                                                    </label>
                                                                </>
                                                            )}

                                                            <button
                                                                onClick={() => void submitReview()}
                                                                disabled={savingReview}
                                                                className={cn(
                                                                    "w-full h-10 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                                                    savingReview
                                                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                                        : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                                                                )}
                                                            >
                                                                {savingReview ? <IconRefresh size={16} className="animate-spin" /> : <IconCheck size={16} />}
                                                                {savingReview ? "Saving..." : "Save Decision"}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Score history */}
                                        {(selectedDetail.qualityScoreHistory || []).length > 0 && (
                                            <div className="px-6 py-5 space-y-3">
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score history</h4>
                                                <div className="space-y-2">
                                                    {(selectedDetail.qualityScoreHistory || []).slice(0, 8).map((item) => (
                                                        <div key={item.id} className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="font-medium text-foreground">{titleCase(item.reason || "Update")}</span>
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">{safeDateTime(item.createdAt)}</span>
                                                            </div>
                                                            <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                                                <span>Score: <span className="font-medium text-foreground">{item.previousScore ?? "—"} → {item.newScore ?? "—"}</span></span>
                                                                <span>State: <span className="font-medium text-foreground">{stateMeta(item.previousState).label} → {stateMeta(item.newState).label}</span></span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            <QualitySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={id}
                onSave={() => {
                    void refreshAll();
                }}
            />
        </div>
    );
}

function KpiCell({ label, hint, value, suffix, sub, valueClassName }: {
    label: string;
    hint: string;
    value: string;
    suffix?: string;
    sub: string;
    valueClassName?: string;
}) {
    return (
        <div className="px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                {label}
                <span title={hint} className="cursor-help text-muted-foreground/60">
                    <IconInfoCircle size={13} strokeWidth={2} />
                </span>
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
                <span className={cn("text-2xl font-bold leading-none text-foreground", valueClassName)}>{value}</span>
                {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                <span className="ml-1 text-xs text-muted-foreground">{sub}</span>
            </div>
        </div>
    );
}

function HowScoringWorksPopover() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors",
                    isOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
            >
                <IconInfoCircle size={14} strokeWidth={2} />
                How scoring works
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-80 bg-card border border-border shadow-xl rounded-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <p className="text-sm text-foreground">
                            Every response is automatically scored <span className="font-semibold">0–100</span> by checks for speeding, straight-lining, and duplicate submissions. Flags subtract points from a perfect 100.
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Review flagged responses to either <span className="font-medium text-foreground">clear</span> them (false alarm) or <span className="font-medium text-foreground">confirm</span> them as bad data.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

function QualityBadge({ meta }: { meta: { label: string; description: string; badge: string } }) {
    return (
        <span
            title={meta.description}
            className={cn(
                "px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold border shadow-sm w-fit whitespace-nowrap cursor-help",
                meta.badge
            )}
        >
            {meta.label}
        </span>
    );
}

function FilterPopover({ value, onChange, options }: {
    value: string;
    onChange: (val: string) => void;
    options: { label: string; value: string }[];
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block ml-1">
            <button
                title="Filter"
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
                        <div className="flex flex-col gap-1">
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={cn(
                                        "text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-muted",
                                        value === opt.value ? "bg-primary/10 text-primary" : "text-foreground"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
