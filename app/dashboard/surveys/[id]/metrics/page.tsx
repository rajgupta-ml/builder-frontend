"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { Survey } from "@/src/shared/types/survey";
import { surveyResponseApi } from "@/api/surveyResponse";
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
    IconSettings
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
import { safeDateTime, safeIdShort } from "@/lib/safe-format";
import { toUserMessage } from "@/lib/api-error";

interface MetricData {
    mode: string;
    views: number;
    starts: number;
    completes: number;
    dropped: number;
    disqualified: number;
    overQuota: number;
    securityTerminate: number;
    ir: number;
    avgTime: number;
}

type ResponsesPayload =
    | any[]
    | {
        data?: any[];
        meta?: {
            orderedHeaders?: string[];
        };
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
    const [isReconcileOpen, setIsReconcileOpen] = useState(false);
    const [resyncing, setResyncing] = useState(false);

    // Pagination State
    // Pagination & Search State
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const itemsPerPage = 10;
    const fetchRunRef = useRef(0);

    const fetchData = async (signal?: AbortSignal) => {
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
            const results = await Promise.all([
                surveyResponseApi.getResponses(id, { signal })
            ]);
            if (signal?.aborted || fetchRunRef.current !== runId) return;
            const responsesData = results[0] as ResponsesPayload;

            const rData = Array.isArray(responsesData) ? responsesData : responsesData.data || [];
            const orderedHeadersFromResponse = Array.isArray(responsesData)
                ? []
                : responsesData.meta?.orderedHeaders || [];
            // Inject duration calculation for frontend display
            const enrichedResponses = rData.map((r: any) => {
                const durationSeconds = r.updatedAt && r.createdAt
                    ? Math.floor((new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 1000)
                    : 0;
                const durationStr = durationSeconds > 0 ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s` : "N/A";
                return { ...r, duration: durationStr };
            });

            setResponses(enrichedResponses);
            setOrderedHeaders(orderedHeadersFromResponse);
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
    };

    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [id]);

    const pollResyncCompletion = async (surveyId: string, maxAttempts = 40, intervalMs = 1500) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const snapshot = await surveyResponseApi.getResyncStatus(surveyId);
            const status = snapshot?.status?.status;
            if (status === "completed" || status === "failed") {
                return snapshot;
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
        return null;
    };

    const handleForceResync = async () => {
        if (!id || resyncing) return;
        try {
            setResyncing(true);
            const queued = await surveyResponseApi.forceResync(id, { full: false, limit: 300, async: true });
            if (queued?.alreadyRunning) {
                toast.info("Resync already running. Waiting for latest status...");
            } else if (queued?.accepted) {
                toast.info("Resync started. Waiting for completion...");
            } else {
                toast.warning(`Resync was not started: ${queued?.reason || "unknown reason"}`);
                return;
            }

            const finalSnapshot = await pollResyncCompletion(id);
            const final = finalSnapshot?.status;
            if (!final) {
                toast.warning("Resync is still running in background. Check status again in a few seconds.");
            } else if (final.status === "completed") {
                toast.success(`Resync complete: applied ${final.applied || 0}, skipped ${final.skipped || 0}, failed ${final.failed || 0}`);
            } else {
                toast.warning(`Resync finished with issues: ${final.reason || "unknown reason"}`);
            }
            await fetchData();
        } catch (error) {
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

    const totalIR = totalMetrics.ir > 0 ? totalMetrics.ir : (
        (totalMetrics.completes + totalMetrics.disqualified) > 0
            ? (totalMetrics.completes / (totalMetrics.completes + totalMetrics.disqualified)) * 100
            : 0
    );

    // Calculate Average Completion Time
    const completedResponses = responses.filter(r => r.status === 'COMPLETED' && r.createdAt && r.updatedAt);
    const avgTimeMs = completedResponses.length > 0
        ? completedResponses.reduce((acc, curr) => {
            const start = new Date(curr.createdAt).getTime();
            const end = new Date(curr.updatedAt).getTime();
            return acc + (end - start);
        }, 0) / completedResponses.length
        : 0;

    const formatTime = (ms: number) => {
        if (ms === 0) return "N/A";
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
    const standardHeaders = ['Respondent ID', 'Date', 'Status', 'Outcome', 'Duration', 'id', 'mode', 'updatedAt', 'createdAt', 'respondentId', 'status', 'outcome', 'Response ID', 'Submitted At', 'Version', 'Survey Name'];
    const dynamicHeaders = orderedHeaders.filter(h => !standardHeaders.includes(h));

    // Fallback if orderedHeaders is missing
    const finalDynamicHeaders = dynamicHeaders.length > 0 ? dynamicHeaders : Array.from(new Set(
        responses.flatMap(r => Object.keys(r))
    )).filter(k => !standardHeaders.includes(k)).sort();

    // Filter Logic
    const filteredResponses = responses.filter(r => {
        // Mode filter is primary
        if (r.mode !== viewMode) return false;
        if (filters['mode'] && r.mode !== filters['mode']) return false;

        // Check filtering for static columns
        if (filters['respondentId'] && !(r.respondentId || "Anonymous").toLowerCase().includes(filters['respondentId'].toLowerCase())) return false;
        if (filters['status'] && !(r.status || "").toLowerCase().includes(filters['status'].toLowerCase())) return false;

        return true;
    });

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
        setCurrentPage(1);
    };

    // Pagination Logic
    const totalPages = Math.ceil(filteredResponses.length / itemsPerPage);
    const paginatedResponses = filteredResponses.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );




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
            {/* Top Navigation / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">{survey?.name}</h1>
                    <p className="mt-2 text-muted-foreground font-medium">{survey?.client} • Performance Overview</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsReconcileOpen(true)}
                        className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all shadow-sm"
                    >
                        Reconcile
                    </button>
                    <button
                        onClick={handleForceResync}
                        disabled={resyncing}
                        className={cn(
                            "px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm",
                            resyncing
                                ? "bg-sky-400 text-white cursor-not-allowed"
                                : "bg-sky-600 text-white hover:bg-sky-700"
                        )}
                    >
                        {resyncing ? "Resyncing..." : "Force Resync"}
                    </button>
                    <button
                        onClick={() => fetchData()}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        title="Refresh Data"
                    >
                        <IconRefresh size={20} />
                    </button>
                    <button
                        onClick={() => setIsQuotaOpen(true)}
                        className="px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted transition-all"
                    >
                        Quotas
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        title="Settings"
                    >
                        <IconSettings size={20} />
                    </button>
                    <button
                        onClick={() => router.push(`/dashboard/surveys/${id}`)}
                        className="px-4 py-2 text-sm font-semibold border border-border rounded-lg hover:bg-muted transition-all"
                    >
                        Open Builder
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all",
                                isExportOpen ? "bg-primary text-primary-foreground shadow-lg" : "bg-primary/10 text-primary hover:bg-primary/20"
                            )}
                        >
                            <IconDownload size={18} />
                            Export Data
                        </button>

                        {isExportOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsExportOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-card border border-border shadow-xl rounded-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => {
                                            surveyResponseApi.exportResponses(id, 'csv');
                                            setIsExportOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                                    >
                                        <IconTable size={16} className="text-emerald-600" />
                                        Export as CSV
                                    </button>
                                    <button
                                        onClick={() => {
                                            surveyResponseApi.exportResponses(id, 'xlsx');
                                            setIsExportOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                                    >
                                        <IconTable size={16} className="text-blue-600" />
                                        Export as Excel
                                    </button>
                                    <button
                                        onClick={() => {
                                            surveyResponseApi.exportResponses(id, 'spss');
                                            setIsExportOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                                    >
                                        <IconTable size={16} className="text-purple-600" />
                                        Export as SPSS
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl w-fit border border-border">
                <button
                    onClick={() => setViewMode('LIVE')}
                    className={cn(
                        "px-6 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide",
                        viewMode === 'LIVE' ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    Live Data
                </button>
                <button
                    onClick={() => setViewMode('TEST')}
                    className={cn(
                        "px-6 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide",
                        viewMode === 'TEST' ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-muted"
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Status Breakdown Bar Chart */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <IconChartBar size={20} className="text-primary" />
                        Conversion Funnel logic
                    </h3>
                    <div className="h-[300px] w-full">
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
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <IconClock size={20} className="text-primary" />
                        Mode Distribution
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={modeData}
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
                        <div className="flex justify-center gap-6 mt-4">
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
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <IconTable size={20} className="text-primary" />
                        Recent Responses
                    </h3>
                </div>
                {responsesLoading && responses.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground bg-muted/10">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        Loading responses...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-wider font-bold">
                                    <th className="px-6 py-4 border-b border-border z-20 min-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <span>Respondent</span>
                                            <FilterPopover
                                                value={filters['respondentId'] || ''}
                                                onChange={(v) => handleFilterChange('respondentId', v)}
                                                type="text"
                                                placeholder="Search ID..."
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 border-b border-border min-w-[150px]">
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
                                    <th className="px-6 py-4 border-b border-border min-w-[100px]">
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
                                        <th key={header} className="px-6 py-4 border-b border-border min-w-[200px]">
                                            <div className="flex flex-col gap-2">
                                                <span className="truncate max-w-[180px]" title={header}>{header}</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 border-b border-border min-w-[100px]">Duration</th>
                                    <th className="px-6 py-4 border-b border-border">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {paginatedResponses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5 + dynamicHeaders.length} className="px-6 py-12 text-center text-muted-foreground">
                                            No responses recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedResponses.map((resp, idx) => (
                                        <tr key={`${resp.id || "resp"}-${idx}`} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-6 py-4 border-b border-border">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm">{resp.respondentId || "Anonymous"}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{safeIdShort(resp.id)}...</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 border-b border-border">
                                                <div className="flex flex-col gap-1">
                                                    <StatusBadge status={resp.status} />
                                                    {resp.outcome && (
                                                        <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[150px]" title={resp.outcome}>
                                                            {resp.outcome}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 border-b border-border">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                    resp.mode === 'LIVE' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                                )}>
                                                    {resp.mode}
                                                </span>
                                            </td>
                                            {finalDynamicHeaders.map((header: string) => {
                                                const displayValue = resp[header];

                                                return (
                                                    <td key={header} className="px-6 py-4 border-b border-border">
                                                        <div className="text-sm font-medium text-foreground line-clamp-2" title={String(displayValue || '')}>
                                                            {displayValue !== undefined && displayValue !== null && displayValue !== '' && displayValue !== '-' ? (
                                                                displayValue
                                                            ) : (
                                                                <span className="text-muted-foreground italic text-xs">N/A</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-4 border-b border-border text-sm font-medium text-muted-foreground">
                                                {resp.duration}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-muted-foreground border-b border-border whitespace-nowrap">
                                                {safeDateTime(resp.createdAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Showing <span className="font-bold text-foreground">{filteredResponses.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, filteredResponses.length)}</span> of <span className="font-bold text-foreground">{filteredResponses.length}</span> responses
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

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
            className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center gap-6"
        >
            <div className={cn("p-4 rounded-xl text-white shadow-lg", color)}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
                <h4 className="text-3xl font-black mt-1 leading-none">{value}</h4>
            </div>
        </motion.div>
    );
}

function MiniMetricCard({ title, value, color }: { title: string, value: string | number, color: string }) {
    return (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <h5 className={cn("text-xl font-black", color)}>{value}</h5>
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
