"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { toast } from "sonner";
import { IconCheck, IconX } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { createSurveySchema } from "@/src/shared/common";

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
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="relative w-full max-w-xl bg-card border border-border shadow-xl rounded-3xl p-8 md:p-10 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute cursor-pointer top-6 right-6 p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-all"
                        >
                            <IconX size={20} />
                        </button>

                        <h2 className="text-3xl font-bold mb-2">Create New Survey</h2>
                        <p className="text-muted-foreground mb-8">Fill in the details below to launch your new survey campaign.</p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium text-muted-foreground ml-1">
                                    Survey Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Q1 Product Feedback"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="client" className="text-sm font-medium text-muted-foreground ml-1">
                                    Client Name
                                </label>
                                <input
                                    id="client"
                                    type="text"
                                    required
                                    value={formData.client}
                                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                                    placeholder="e.g. Acme Corp"
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="description" className="text-sm font-medium text-muted-foreground ml-1">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the purpose of this survey..."
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-6 cursor-pointer py-4 border border-border text-foreground font-bold rounded-xl hover:bg-accent transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-2 flex cursor-pointer items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-sm"
                                >
                                    {loading ? (
                                        <div className="h-5 w-5  border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <IconCheck size={20} />
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
    );
}
