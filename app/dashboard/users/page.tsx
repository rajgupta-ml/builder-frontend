"use client";
import React, { useEffect, useState } from 'react';
import {
    IconUsers,
    IconSearch,
    IconFilter,
    IconDownload,
    IconChevronLeft,
    IconChevronRight,
    IconExternalLink
} from '@tabler/icons-react';
import { surveyResponseApi } from '@/api/surveyResponse';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { safeDate, safeIdShort, safeOpenExternal, safeText } from '@/lib/safe-format';
import { toUserMessage } from '@/lib/api-error';
import { toast } from 'sonner';

export default function RespondentsPage() {
    const [responses, setResponses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, []);

    const fetchData = async (signal?: AbortSignal) => {
        if (!signal?.aborted) {
            setFetchError(null);
        }
        try {
            const data = await surveyResponseApi.getAllUserResponses({ signal });
            setResponses(data);
        } catch (error) {
            if (signal?.aborted) return;
            console.error("Failed to fetch respondents", error);
            const message = toUserMessage(error, "Failed to load respondents");
            setFetchError(message);
            toast.error(message);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const filteredResponses = responses.filter(r =>
        (r.respondentId || "Anonymous").toLowerCase().includes(search.toLowerCase()) ||
        (r.survey?.name || "").toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredResponses.length / itemsPerPage);
    const paginated = filteredResponses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-8 md:p-12 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Survey Respondents</h1>
                    <p className="mt-2 text-muted-foreground font-medium">Manage all individuals across your research campaigns</p>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
                <div className="flex-1 relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search by respondent ID or survey name..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-muted/30 border border-border focus:border-primary/50 h-11 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 h-11 bg-muted/50 border border-border rounded-xl text-sm font-semibold hover:bg-muted transition-all">
                        <IconFilter size={18} />
                        Filter
                    </button>
                    <button className="flex items-center gap-2 px-4 h-11 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all">
                        <IconDownload size={18} />
                        Export All
                    </button>
                </div>
            </div>

            {/* Respondents Table */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                {!loading && fetchError ? (
                    <div className="p-12 text-center">
                        <h3 className="text-lg font-bold mb-2">Could not load respondents</h3>
                        <p className="text-sm text-muted-foreground mb-5">{fetchError}</p>
                        <button
                            onClick={() => {
                                setLoading(true);
                                fetchData();
                            }}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-wider font-bold">
                                <th className="px-6 py-4">Respondent ID</th>
                                <th className="px-6 py-4">Survey Campaign</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Completion Date</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={5} className="px-6 py-6 animate-pulse bg-muted/10 h-16" />
                                    </tr>
                                ))
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground">
                                        No respondents found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((resp, idx) => (
                                    <tr key={`${resp.id || "resp"}-${idx}`} className="hover:bg-muted/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-primary/5">
                                                    {safeText(resp.respondentId, "A").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{resp.respondentId || "Anonymous"}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">Response ID: {safeIdShort(resp.id)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">{resp.survey?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={resp.status} />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {safeDate(resp.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => safeOpenExternal(`/dashboard/surveys/${resp.surveyId}/metrics`)}
                                                className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                                title="View in Context"
                                            >
                                                <IconExternalLink size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                )}

                {/* Pagination */}
                {!loading && !fetchError && totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/10">
                        <span className="text-xs text-muted-foreground font-medium">
                            Showing <span className="text-foreground">{((currentPage - 1) * itemsPerPage) + 1}</span>-
                            <span className="text-foreground">{Math.min(currentPage * itemsPerPage, filteredResponses.length)}</span> of
                            <span className="text-foreground"> {filteredResponses.length}</span> respondents
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                title='Left Icon'
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-border rounded-lg hover:bg-muted disabled:opacity-30 transition-all font-bold text-xs"
                            >
                                <IconChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => (
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
                                )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                            </div>
                            <button
                                title='Right Icon'
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-border rounded-lg hover:bg-muted disabled:opacity-30 transition-all font-bold text-xs"
                            >
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        COMPLETED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        DROPPED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
        DISQUALIFIED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        QUALITY_TERMINATE: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        SECURITY_TERMINATE: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
        OVER_QUOTA: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
        IN_PROGRESS: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    };

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm",
            variants[status] || "bg-gray-100 text-gray-600 border-gray-200"
        )}>
            {String(status || "UNKNOWN").replace(/_/g, ' ')}
        </span>
    );
}
