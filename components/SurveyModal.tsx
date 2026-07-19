"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { surveyLinkApi, type AvailableGleProject } from "@/api/surveyLink";
import { toast } from "sonner";
import { IconCheck, IconX, IconLink, IconChevronDown, IconLoader2 } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { createSurveySchema } from "@/src/shared/common";
import { JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { getStoredUserScopes, hasPermission, PERMISSIONS } from "@/lib/permissions";

const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"] });

interface NewSurveyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function NewSurveyModal({ isOpen, onClose, onSuccess }: NewSurveyModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        client: ""
    });

    const canLink = hasPermission(getStoredUserScopes(), PERMISSIONS.SURVEY_EDIT);
    const [showGlePicker, setShowGlePicker] = useState(false);
    const [gleProjects, setGleProjects] = useState<AvailableGleProject[]>([]);
    const [gleProjectsLoading, setGleProjectsLoading] = useState(false);
    const [selectedGleProjectId, setSelectedGleProjectId] = useState('');

    const openGlePicker = async () => {
        setShowGlePicker(true);
        setGleProjectsLoading(true);
        try {
            const projects = await surveyLinkApi.getAvailableGleProjects();
            setGleProjects(projects);
        } catch {
            setGleProjects([]);
        } finally {
            setGleProjectsLoading(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate using SSOT Schema
            const validation = createSurveySchema.safeParse(formData);

            if (!validation.success) {
                const errorMessage = validation.error.message;
                toast.error(errorMessage);
                setLoading(false);
                return;
            }

            const res = await surveyApi.createSurvey(validation.data);

            if (selectedGleProjectId && res?.id) {
                try {
                    await surveyLinkApi.linkSurveyToGle(res.id, selectedGleProjectId);
                } catch { /* non-fatal — user can link from survey settings */ }
            }

            toast.success("Survey created successfully!");
            onSuccess();
            onClose();
            setFormData({ name: "", description: "", client: "" });
            setShowGlePicker(false);
            setSelectedGleProjectId('');

            // Redirect to design area
            if (res && res.id) {
                router.push(`/dashboard/surveys/${res.id}`);
            }
        } catch (error) {
            console.error("Failed to create survey:", error);
            toast.error("Failed to create survey. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-120 h-dvh w-screen flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-background border border-border/60 shadow-xl rounded-xl p-8 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                        <button
                            title="X Icon"
                            onClick={onClose}
                            className="absolute cursor-pointer top-6 right-6 p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all rounded-md"
                        >
                            <IconX size={18} strokeWidth={1.5} />
                        </button>

                        <div className="mb-8">
                            <h2 className="text-xl font-semibold mb-2 text-foreground">Create New Survey</h2>
                            <p className="text-xs text-muted-foreground">Fill in the details below to initialize a new data collection task.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1">
                                <label htmlFor="name" className={`text-xs text-muted-foreground ${jetBrainsMono.className}`}>
                                    SURVEY NAME
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Q1 Product Feedback"
                                    className="w-full bg-background border border-border/60 px-3 py-2 text-sm text-foreground rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors mt-1"
                                />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="client" className={`text-xs text-muted-foreground ${jetBrainsMono.className}`}>
                                    CLIENT
                                </label>
                                <input
                                    id="client"
                                    type="text"
                                    required
                                    value={formData.client}
                                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                                    placeholder="e.g. Acme Corp"
                                    className="w-full bg-background border border-border/60 px-3 py-2 text-sm text-foreground rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors mt-1"
                                />
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="description" className={`text-xs text-muted-foreground ${jetBrainsMono.className}`}>
                                    DESCRIPTION
                                </label>
                                <textarea
                                    id="description"
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the objective..."
                                    className="w-full bg-background border border-border/60 px-3 py-2 text-sm text-foreground rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors resize-none mt-1"
                                />
                            </div>

                            {canLink && !showGlePicker && (
                                <button
                                    type="button"
                                    onClick={openGlePicker}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground transition-all group"
                                >
                                    <IconLink size={12} className="shrink-0" />
                                    <span>Link to a GLE project</span>
                                    <span className="ml-auto text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">optional</span>
                                </button>
                            )}
                            {showGlePicker && (
                                <div className="rounded-xl border border-border/60 overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                        <span className="text-xs font-semibold flex items-center gap-2">
                                            <IconLink size={12} className="text-primary" />
                                            Link to a GLE project
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setShowGlePicker(false); setSelectedGleProjectId(''); }}
                                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        >
                                            <IconX size={13} />
                                        </button>
                                    </div>
                                    <div className="px-4 py-3 space-y-3">
                                        {gleProjectsLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                                <IconLoader2 size={12} className="animate-spin" />
                                                Loading projects...
                                            </div>
                                        ) : gleProjects.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-1">No unlinked GLE projects available.</p>
                                        ) : (
                                            <div className="relative">
                                                <select
                                                    value={selectedGleProjectId}
                                                    onChange={(e) => setSelectedGleProjectId(e.target.value)}
                                                    className="w-full appearance-none bg-background border border-border/60 px-3 py-2.5 pr-8 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-foreground"
                                                >
                                                    <option value="">— Choose a project —</option>
                                                    {gleProjects.map((p) => (
                                                        <option key={p.publicId} value={p.publicId}>
                                                            {p.name} · {p.publicId}
                                                        </option>
                                                    ))}
                                                </select>
                                                <IconChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                            </div>
                                        )}
                                        {selectedGleProjectId && (
                                            <p className="text-[11px] text-primary/80 font-medium">Will be linked once the survey is created.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 mt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2 border border-border/60 text-xs font-medium text-foreground hover:bg-muted transition-colors rounded-full"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center justify-center gap-2 bg-primary/10 text-primary px-5 py-2 text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 rounded-full"
                                >
                                    {loading ? (
                                        <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <IconCheck size={16} strokeWidth={2} />
                                            Create Survey
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}
