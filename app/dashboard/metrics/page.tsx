"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChartBar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { surveyApi } from "@/api/survey";
import { surveyResponseApi } from "@/api/surveyResponse";
import type { Surveys } from "@/src/shared/types/survey";
import { toUserMessage } from "@/lib/api-error";
import { toast } from "sonner";
import { jetBrainsMono } from "@/lib/fonts";
import { AnimatePresence, motion } from "framer-motion";

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

    const screenedCount =
        totals.completes +
        totals.disqualified +
        totals.overQuota +
        totals.securityTerminate;
    const ir = screenedCount > 0 ? (totals.completes / screenedCount) * 100 : 0;

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
    const [totalPages, setTotalPages] = useState(1);
    const [totalSurveys, setTotalSurveys] = useState(0);
    const searchTerm = searchParams.get("search")?.trim() ?? "";

    useEffect(() => {
        const controller = new AbortController();
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                const surveysResult = await surveyApi.getSurveys({
                    signal: controller.signal,
                    search: searchTerm,
                    page: currentPage,
                    limit: PAGE_SIZE,
                });
                const surveys = surveysResult.data;
                setTotalPages(surveysResult.meta.totalPages || 1);
                setTotalSurveys(surveysResult.meta.total || surveys.length);
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
    }, [searchTerm, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="p-8 md:p-12 w-full max-w-7xl mx-auto space-y-6">
            <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
            >
                <IconChartBar size={24} className="text-muted-foreground" />
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Global Analytics</h1>
                    <p className="text-sm text-muted-foreground">All surveys with aggregate metrics and quick drill-down. ({totalSurveys} total)</p>
                </div>
            </motion.div>

            <div className="bg-background border border-border/60 rounded-xl overflow-visible">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-12 text-center text-muted-foreground"
                        >
                            Loading analytics...
                        </motion.div>
                    ) : error ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="p-12 text-center space-y-4"
                        >
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                            >
                                Retry
                            </button>
                        </motion.div>
                    ) : rows.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="p-12 text-center text-muted-foreground"
                        >
                            No surveys found.
                        </motion.div>
                    ) : (
                        <motion.div
                            key="table"
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={{
                                visible: { transition: { staggerChildren: 0.05 } },
                            }}
                        >
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-fixed">
                                <thead>
                                    <tr
                                        className={`border-b border-border/60 bg-muted/30 text-[10px] uppercase text-muted-foreground tracking-wider ${jetBrainsMono.className}`}
                                    >
                                        <th className="px-6 py-4 font-normal min-w-[260px]">Survey</th>
                                        <th className="px-6 py-4 font-normal">Views</th>
                                        <th className="px-6 py-4 font-normal">Starts</th>
                                        <th className="px-6 py-4 font-normal">Completes</th>
                                        <th className="px-6 py-4 font-normal">Dropped</th>
                                        <th className="px-6 py-4 font-normal">Disqualified</th>
                                        <th className="px-6 py-4 font-normal">IR</th>
                                        <th className="px-6 py-4 font-normal text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {rows.map((row, i) => (
                                        <motion.tr
                                            key={row.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-primary/5 transition-colors group cursor-pointer relative"
                                            onClick={() => router.push(`/dashboard/surveys/${row.id}/metrics`)}
                                        >
                                            <td className="px-6 py-4 border-l-2 border-transparent group-hover:border-primary transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
                                                    <span className={`text-xs text-muted-foreground group-hover:text-primary/80 transition-colors ${jetBrainsMono.className}`}>
                                                        ID-{row.id.slice(-8).toUpperCase()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 text-sm ${jetBrainsMono.className}`}>{row.views}</td>
                                            <td className={`px-6 py-4 text-sm ${jetBrainsMono.className}`}>{row.starts}</td>
                                            <td className={`px-6 py-4 text-sm ${jetBrainsMono.className}`}>{row.completes}</td>
                                            <td className={`px-6 py-4 text-sm ${jetBrainsMono.className}`}>{row.dropped}</td>
                                            <td className={`px-6 py-4 text-sm ${jetBrainsMono.className}`}>{row.disqualified}</td>
                                            <td className={`px-6 py-4 text-sm ${jetBrainsMono.className}`}>{row.ir.toFixed(1)}%</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        router.push(`/dashboard/surveys/${row.id}/metrics`);
                                                    }}
                                                    className={`px-3 py-1.5 text-xs border border-border/60 rounded-md hover:bg-muted transition-colors ${jetBrainsMono.className}`}
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </motion.tr>
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
