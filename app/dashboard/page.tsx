"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { toast } from "sonner";
import { IconPlus, IconClipboardList, IconEdit, IconTrash } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { Survey } from "@/src/shared/types/survey";

export default function Dashboard() {
    const router = useRouter();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSurveys();
    }, []);

    const fetchSurveys = async () => {
        try {
            const data = await surveyApi.getSurveys();
            setSurveys(data);
        } catch (error) {
            console.error("Failed to fetch surveys:", error);
            toast.error("Failed to load surveys");
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="p-8 md:p-12 relative">
            {/* Page Title */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-4xl font-bold tracking-tight">
                        My Surveys
                    </h1>
                    <p className="mt-2 text-muted-foreground font-medium">
                        You have {surveys.length} active campaigns
                    </p>
                </motion.div>
            </div>

            {/* Content */}
            <main className="max-w-7xl mx-auto">
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
                    ) : surveys.length > 0 ? (
                        <motion.div
                            key="grid"
                            initial="hidden"
                            animate="visible"
                            variants={{
                                visible: { transition: { staggerChildren: 0.1 } }
                            }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {surveys.map((survey) => (
                                <motion.div
                                    key={survey.id}
                                    variants={{
                                        hidden: { opacity: 0, y: 20 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    className="group relative bg-card border border-border hover:border-primary/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <IconClipboardList size={24} />
                                        </div>

                                        {/* Status Badge */}
                                        {survey.latestWorkflow?.status === 'PUBLISHED' ? (
                                            <span className="px-2.5 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider rounded-full border border-green-500/20 shadow-sm flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                Live
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider rounded-full border border-zinc-200">
                                                Draft
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-card-foreground mb-2 group-hover:text-primary transition-colors">
                                        {survey.name}
                                    </h3>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                        <span>{new Date(survey.createdAt).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>{survey.client}</span>
                                    </div>

                                    <p className="text-muted-foreground text-sm line-clamp-2 mb-6 h-10">
                                        {survey.description || "No description provided"}
                                    </p>

                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Responses</span>
                                            <span className="text-lg font-black">{survey.metrics?.completed || 0}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">IR</span>
                                            <span className="text-lg font-black text-amber-600">{survey.metrics?.ir?.toFixed(1) || 0}%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(`/dashboard/surveys/${survey.id}`)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary text-xs font-semibold rounded-md hover:bg-primary/10 transition-colors"
                                            >
                                                <IconEdit size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => router.push(`/dashboard/surveys/${survey.id}/metrics`)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-md hover:bg-blue-100 transition-colors"
                                            >
                                                Metrics
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Are you sure you want to delete this survey?")) {
                                                        try {
                                                            await surveyApi.deleteSurvey(survey.id);
                                                            toast.success("Survey deleted");
                                                            fetchSurveys();
                                                        } catch (err) {
                                                            toast.error("Failed to delete");
                                                        }
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-md hover:bg-red-100 transition-colors"
                                            >
                                                <IconTrash size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 bg-muted/20 border border-dashed border-border rounded-3xl"
                        >
                            <div className="inline-flex items-center justify-center p-4 bg-muted rounded-2xl text-muted-foreground mb-4">
                                <IconClipboardList size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">No surveys yet</h3>
                            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                                Get started by creating your first survey campaign to gather valuable insights.
                            </p>
                            <button
                                // onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-full hover:bg-secondary/80 transition-all"
                            >
                                <IconPlus size={20} />
                                Create First Survey
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}