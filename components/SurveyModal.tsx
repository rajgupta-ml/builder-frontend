"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { toast } from "sonner";
import { IconCheck, IconX, IconSettings } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { createSurveySchema } from "@/src/shared/common";
import { JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { ModalPortal } from "@/components/ui/ModalPortal";

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
            toast.success("Survey created successfully!");
            onSuccess();
            onClose();
            setFormData({ name: "", description: "", client: "" });

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
                            className="relative w-full max-w-lg bg-background border border-border/60 shadow-xl rounded-xl p-8 pointer-events-auto"
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
