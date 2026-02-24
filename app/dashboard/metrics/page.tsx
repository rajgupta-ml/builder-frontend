"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChartBar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { surveyApi } from "@/api/survey";
import { surveyResponseApi } from "@/api/surveyResponse";
import type { Surveys } from "@/src/shared/types/survey";
import { toUserMessage } from "@/lib/api-error";
import { toast } from "sonner";

type SurveyModeMetrics = {
    mode: string;
    views?: number;
    starts?: number;
    completes?: number;
    dropped?: number;
    disqualified?: number;
    overQuota?: number;
    securityTerminate?: number;
    ir?: number;
};

type SurveyAnalyticsRow = {
    id: string;
    name: string;
    client: string;
    views: number;
    starts: number;
    completes: number;
    dropped: number;
    disqualified: number;
    overQuota: number;
    securityTerminate: number;
    ir: number;
};

const PAGE_SIZE = 10;

const toNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const toAnalyticsRow = (survey: Surveys, modes: SurveyModeMetrics[]): SurveyAnalyticsRow => {
    const totals = modes.reduce(
        (acc, mode) => {
            acc.views += toNumber(mode.views);
            acc.starts += toNumber(mode.starts);
            acc.completes += toNumber(mode.completes);
            acc.dropped += toNumber(mode.dropped);
            acc.disqualified += toNumber(mode.disqualified);
            acc.overQuota += toNumber(mode.overQuota);
            acc.securityTerminate += toNumber(mode.securityTerminate);
            return acc;
        },
        {
            views: 0,
            starts: 0,
            completes: 0,
            dropped: 0,
            disqualified: 0,
            overQuota: 0,
            securityTerminate: 0,
        }
    );

    const denominator = totals.completes + totals.disqualified;
    const ir = denominator > 0 ? (totals.completes / denominator) * 100 : 0;

    return {
        id: survey.id,
        name: survey.name,
        client: survey.client,
        ...totals,
        ir,
    };
};

export default function GlobalMetricsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<SurveyAnalyticsRow[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const searchTerm = searchParams.get("search")?.trim() ?? "";

    useEffect(() => {
        const controller = new AbortController();
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            setCurrentPage(1);
            try {
                const surveys = await surveyApi.getSurveys({ signal: controller.signal, search: searchTerm });
                const results = await Promise.allSettled(
                    surveys.map(async (survey) => {
                        const metrics = await surveyResponseApi.getMetrics(survey.id, { signal: controller.signal });
                        return toAnalyticsRow(survey, (metrics?.modes || []) as SurveyModeMetrics[]);
                    })
                );
                if (controller.signal.aborted) return;

                const successfulRows = results
                    .filter((result): result is PromiseFulfilledResult<SurveyAnalyticsRow> => result.status === "fulfilled")
                    .map((result) => result.value);
                const failedCount = results.length - successfulRows.length;

                setRows(successfulRows);
                if (failedCount > 0) {
                    toast.warning(`Loaded ${successfulRows.length}/${results.length} surveys. Some metrics could not be fetched.`);
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                const message = toUserMessage(err, "Failed to load global analytics");
                setError(message);
                toast.error(message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void fetchAll();
        return () => controller.abort();
    }, [searchTerm]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pagedRows = useMemo(
        () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [rows, currentPage]
    );

    return (
        <div className="p-8 md:p-12 w-full max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <IconChartBar size={24} className="text-muted-foreground" />
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Global Analytics</h1>
                    <p className="text-sm text-muted-foreground">All surveys with aggregate metrics and quick drill-down.</p>
                </div>
            </div>

            <div className="bg-background border border-border/60 rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-muted-foreground">Loading analytics...</div>
                ) : error ? (
                    <div className="p-12 text-center space-y-4">
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                        >
                            Retry
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">No surveys found.</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-auto border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-muted/30 text-muted-foreground text-xs font-medium">
                                        <th className="px-6 py-3 border-b border-border/60 min-w-[260px]">Survey</th>
                                        <th className="px-6 py-3 border-b border-border/60">Views</th>
                                        <th className="px-6 py-3 border-b border-border/60">Starts</th>
                                        <th className="px-6 py-3 border-b border-border/60">Completes</th>
                                        <th className="px-6 py-3 border-b border-border/60">Dropped</th>
                                        <th className="px-6 py-3 border-b border-border/60">Disqualified</th>
                                        <th className="px-6 py-3 border-b border-border/60">IR</th>
                                        <th className="px-6 py-3 border-b border-border/60 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-primary/5 transition-colors">
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-foreground">{row.name}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">ID-{row.id.slice(-8).toUpperCase()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm">{row.views}</td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm">{row.starts}</td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm">{row.completes}</td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm">{row.dropped}</td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm">{row.disqualified}</td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm">{row.ir.toFixed(1)}%</td>
                                            <td className="px-6 py-3 border-b border-border/60 text-right">
                                                <button
                                                    onClick={() => router.push(`/dashboard/surveys/${row.id}/metrics`)}
                                                    className="px-3 py-1.5 text-xs font-medium border border-border/60 rounded-md hover:bg-muted transition-all"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-border/60 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <IconChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <IconChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
