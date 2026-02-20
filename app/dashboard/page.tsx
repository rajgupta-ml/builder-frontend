"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { toast } from "sonner";
import { IconPlus, IconClipboardList, IconLayoutList } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { Surveys } from "@/src/shared/types/survey";
import NewSurveyModal from "@/components/SurveyModal";
import { toUserMessage } from "@/lib/api-error";
import { jetBrainsMono } from "@/app/dashboard/layout";
import { cn } from "@/lib/utils";
import { getStoredUserRole, hasPermission, PERMISSIONS } from "@/lib/permissions";

export default function Dashboard() {
    const router = useRouter();
    const [surveys, setSurveys] = useState<Surveys[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [canCreateSurvey, setCanCreateSurvey] = useState(false);
    const [canDeleteSurvey, setCanDeleteSurvey] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetchSurveys(controller.signal);
        const role = getStoredUserRole();
        setCanCreateSurvey(hasPermission(role, PERMISSIONS.SURVEY_CREATE));
        setCanDeleteSurvey(hasPermission(role, PERMISSIONS.SURVEY_DELETE));
        return () => controller.abort();
    }, []);

    const fetchSurveys = async (signal?: AbortSignal) => {
        if (!signal?.aborted) {
            setFetchError(null);
        }
        try {
            const data = await surveyApi.getSurveys({ signal });
            setSurveys(data);
        } catch (error) {
            if (signal?.aborted) return;
            console.error("Failed to fetch surveys:", error);
            const message = toUserMessage(error, "Failed to load surveys");
            setFetchError(message);
            toast.error(message);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };


    return (
        <div className="p-8 md:p-12 relative">
            {/* Page Title */}
            <NewSurveyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => { }} // Modal handles redirect
            />

            <div className="max-w-6xl mx-auto flex items-baseline justify-between mb-8 border-b border-border/60 pb-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-2xl font-semibold text-foreground mb-2">
                        Active Surveys
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Overview of running data collection tasks. ({surveys.length} total)
                    </p>
                </motion.div>
                <div className={`text-xs border border-border px-3 py-1 rounded shadow-sm flex items-center gap-2 text-muted-foreground ${jetBrainsMono.className}`}>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" /> System Nominal
                </div>
            </div>

            {/* Content */}
            <main className="max-w-6xl mx-auto">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse border border-border" />
                            ))}
                        </motion.div>
                    ) : fetchError ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 bg-card border border-border rounded-2xl"
                        >
                            <h3 className="text-xl font-bold text-foreground mb-2">Could not load surveys</h3>
                            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{fetchError}</p>
                            <button
                                onClick={() => {
                                    setLoading(true);
                                    fetchSurveys();
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all"
                            >
                                Retry
                            </button>
                        </motion.div>
                    ) : surveys.length > 0 ? (
                        <motion.div
                            key="grid"
                            initial="hidden"
                            animate="visible"
                            variants={{
                                visible: { transition: { staggerChildren: 0.1 } }
                            }}
                            className="border border-border/60 rounded-xl overflow-hidden bg-background"
                        >
                            <table className="w-full text-left table-fixed">
                                <thead>
                                    <tr className={`border-b border-border/60 bg-muted/30 text-[10px] uppercase text-muted-foreground tracking-wider ${jetBrainsMono.className}`}>
                                        <th className="px-6 py-4 font-normal w-1/3">Survey ID / Name</th>
                                        <th className="px-6 py-4 font-normal">Status</th>
                                        <th className="px-6 py-4 font-normal hidden sm:table-cell">Client</th>
                                        <th className="px-6 py-4 font-normal text-right hidden md:table-cell">Modified</th>
                                        <th className="px-6 py-4 font-normal text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {surveys.map((survey, i) => (
                                        <motion.tr
                                            key={survey.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-primary/5 transition-colors group cursor-pointer relative"
                                            onClick={() => router.push(`/dashboard/surveys/${survey.id}/metrics`)}
                                        >
                                            <td className="px-6 py-4 border-l-2 border-transparent group-hover:border-primary transition-colors">
                                                <div className={`text-xs text-muted-foreground group-hover:text-primary/80 transition-colors mb-1 ${jetBrainsMono.className}`}>
                                                    ID-{survey.id.slice(-6).toUpperCase()}
                                                </div>
                                                <div className="text-sm font-medium text-foreground truncate">
                                                    {survey.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    `text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-md ${jetBrainsMono.className}`,
                                                    survey.status !== 'live' && "bg-secondary text-secondary-foreground border-border"
                                                )}>
                                                    {survey.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 hidden sm:table-cell text-sm text-foreground ${jetBrainsMono.className}`}>
                                                {survey.client || '-'}
                                            </td>
                                            <td className={`px-6 py-4 text-right hidden md:table-cell text-xs text-muted-foreground group-hover:text-foreground transition-colors ${jetBrainsMono.className}`}>
                                                {new Date(survey.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/dashboard/surveys/${survey.id}/metrics`);
                                                        }}
                                                        className={`text-[10px] text-muted-foreground hover:text-primary hover:border-primary/50 border border-transparent px-2 py-1 rounded transition-all ${jetBrainsMono.className}`}
                                                    >
                                                        DATA
                                                    </button>
                                                    {canDeleteSurvey && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (confirm("Execute command: DELETE SURVEY?")) {
                                                                    try {
                                                                        await surveyApi.deleteSurvey(survey.id);
                                                                        toast.success("Survey record deleted");
                                                                        fetchSurveys();
                                                                    } catch (err) {
                                                                        toast.error("Deletion failed");
                                                                    }
                                                                }
                                                            }}
                                                            className={`text-[10px] text-muted-foreground hover:text-destructive border border-transparent hover:border-destructive/20 px-2 py-1 rounded transition-all ${jetBrainsMono.className}`}
                                                        >
                                                            DEL
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-background/95 backdrop-blur-sm border border-primary/20 rounded-2xl p-16 text-center shadow-xl shadow-primary/5"
                        >
                            <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-xl text-primary mb-6 border border-primary/20">
                                <IconLayoutList size={40} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-foreground mb-3">No Target Records Found</h3>
                            <p className="text-sm text-foreground/60 mb-8 max-w-md mx-auto font-medium">
                                The system database currently contains zero active or draft survey records. Initialize a new record to begin data collection.
                            </p>
                            {canCreateSurvey && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm tracking-wide rounded-lg hover:opacity-90 transition-all shadow-md shadow-primary/20"
                                >
                                    <IconPlus size={18} strokeWidth={2.5} />
                                    INITIALIZE RECORD
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
