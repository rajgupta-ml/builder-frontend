"use client";
import { useEffect, useState } from "react";
import { surveyApi } from "@/api/survey";
import { Survey } from "@/src/shared/types/survey";
import { toast } from "sonner";
import { IconDeviceFloppy, IconExternalLink, IconAlertTriangle, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SurveySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onSave?: () => void; // Final callback to refresh state in parent
}

export function SurveySettingsModal({ isOpen, onClose, surveyId, onSave }: SurveySettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [survey, setSurvey] = useState<Survey | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        redirectUrl: "",
        overQuotaUrl: "",
        securityTerminateUrl: "",
        globalQuota: ""
    });

    useEffect(() => {
        if (isOpen && surveyId) {
            fetchSurvey();
        }
    }, [isOpen, surveyId]);

    const fetchSurvey = async () => {
        setLoading(true);
        try {
            const data = await surveyApi.getSurvey(surveyId);
            setSurvey(data);
            setFormData({
                redirectUrl: data.redirectUrl || "",
                overQuotaUrl: data.overQuotaUrl || "",
                securityTerminateUrl: data.securityTerminateUrl || "",
                globalQuota: data.globalQuota !== null ? String(data.globalQuota) : ""
            });
        } catch (error) {
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            console.log("Survey Settings Modal handleSave called", formData);
            await surveyApi.updateSurvey(surveyId, {
                name: survey?.name || "", // Preserve existing name
                description: survey?.description || "",
                redirectUrl: formData.redirectUrl || null,
                overQuotaUrl: formData.overQuotaUrl || null,
                securityTerminateUrl: formData.securityTerminateUrl || null,
                globalQuota: formData.globalQuota ? parseInt(formData.globalQuota) : null
            });
            toast.success("Settings saved successfully");
            if (onSave) onSave();
            onClose();
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h3 className="text-xl font-bold">Survey Settings</h3>
                                <p className="text-xs text-muted-foreground">Configure limits and redirects for this survey.</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-8 flex-1">
                            {loading ? (
                                <div className="py-12 flex justify-center">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Traffic Control Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                                            <IconAlertTriangle size={18} className="text-fuchsia-600" />
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Traffic Control</h4>
                                        </div>

                                        <div className="grid gap-2">
                                            <label className="text-sm font-semibold">Total Response Limit (Global Quota)</label>
                                            <input
                                                type="number"
                                                placeholder="e.g. 1000"
                                                className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                value={formData.globalQuota}
                                                onChange={(e) => setFormData(prev => ({ ...prev, globalQuota: e.target.value }))}
                                            />
                                            <p className="text-xs text-muted-foreground">Stops the survey after this many successful completions.</p>
                                        </div>

                                        <div className="grid gap-2">
                                            <label className="text-sm font-semibold">Over Quota Redirect URL</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="url"
                                                    placeholder="https://example.com/over-quota"
                                                    className="flex-1 bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    value={formData.overQuotaUrl}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, overQuotaUrl: e.target.value }))}
                                                />
                                                <button className="p-3 hover:bg-muted rounded-xl border border-border text-muted-foreground" onClick={() => formData.overQuotaUrl && window.open(formData.overQuotaUrl, '_blank')}>
                                                    <IconExternalLink size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Redirects Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                                            <IconExternalLink size={18} className="text-blue-600" />
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Redirects</h4>
                                        </div>

                                        <div className="grid gap-2">
                                            <label className="text-sm font-semibold">Default Completion Redirect</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="url"
                                                    placeholder="https://example.com/thank-you"
                                                    className="flex-1 bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    value={formData.redirectUrl}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, redirectUrl: e.target.value }))}
                                                />
                                                <button className="p-3 hover:bg-muted rounded-xl border border-border text-muted-foreground" onClick={() => formData.redirectUrl && window.open(formData.redirectUrl, '_blank')}>
                                                    <IconExternalLink size={20} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <label className="text-sm font-semibold">Security Terminate Redirect</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="url"
                                                    placeholder="https://example.com/security-fail"
                                                    className="flex-1 bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    value={formData.securityTerminateUrl}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, securityTerminateUrl: e.target.value }))}
                                                />
                                                <button className="p-3 hover:bg-muted rounded-xl border border-border text-muted-foreground" onClick={() => formData.securityTerminateUrl && window.open(formData.securityTerminateUrl, '_blank')}>
                                                    <IconExternalLink size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || loading}
                                className="flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg shadow hover:bg-primary/90 transition-all disabled:opacity-70"
                            >
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <IconDeviceFloppy size={18} />}
                                Save Changes
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
