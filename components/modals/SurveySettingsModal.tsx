"use client";
import { useEffect, useState } from "react";
import { surveyApi } from "@/api/survey";
import { surveyLinkApi, type SurveyGleLink, type AvailableGleProject } from "@/api/surveyLink";
import { Survey } from "@/src/shared/types/survey";
import { toast } from "sonner";
import { IconDeviceFloppy, IconExternalLink, IconAlertTriangle, IconX, IconLink, IconLinkOff, IconLoader2, IconChevronDown } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { safeOpenExternal } from "@/lib/safe-format";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { getStoredUserScopes, hasPermission, PERMISSIONS } from "@/lib/permissions";

const GLE_BASE = process.env.NEXT_PUBLIC_GLE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:5173" : "https://gle.algorithmicintelmatrix.com");

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

    // GLE link state
    const [gleLink, setGleLink] = useState<SurveyGleLink | null | undefined>(undefined);
    const [gleLinkLoading, setGleLinkLoading] = useState(false);
    const [confirmUnlink, setConfirmUnlink] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [showGlePicker, setShowGlePicker] = useState(false);
    const [gleProjects, setGleProjects] = useState<AvailableGleProject[]>([]);
    const [gleProjectsLoading, setGleProjectsLoading] = useState(false);
    const [selectedGleProjectId, setSelectedGleProjectId] = useState('');
    const [linking, setLinking] = useState(false);

    const canLink = hasPermission(getStoredUserScopes(), PERMISSIONS.SURVEY_EDIT);

    // Form State
    const [formData, setFormData] = useState({
        redirectUrl: "",
        overQuotaUrl: "",
        securityTerminateUrl: "",
        globalQuota: "",
        piiOverrideDenylist: ""
    });

    useEffect(() => {
        const controller = new AbortController();
        if (isOpen && surveyId) {
            fetchSurvey(controller.signal);
            fetchGleLink();
        }
        if (!isOpen) {
            setGleLink(undefined);
            setConfirmUnlink(false);
            setShowGlePicker(false);
            setSelectedGleProjectId('');
        }
        return () => controller.abort();
    }, [isOpen, surveyId]);

    const fetchGleLink = async () => {
        setGleLinkLoading(true);
        try {
            const link = await surveyLinkApi.getSurveyLink(surveyId);
            setGleLink(link);
        } catch {
            setGleLink(null);
        } finally {
            setGleLinkLoading(false);
        }
    };

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

    const handleLinkToGle = async () => {
        if (!selectedGleProjectId) return;
        setLinking(true);
        try {
            const link = await surveyLinkApi.linkSurveyToGle(surveyId, selectedGleProjectId);
            setGleLink(link);
            setShowGlePicker(false);
            setSelectedGleProjectId('');
            toast.success("Linked to GLE project");
        } catch {
            toast.error("Failed to link");
        } finally {
            setLinking(false);
        }
    };

    const handleUnlink = async () => {
        setUnlinking(true);
        try {
            await surveyLinkApi.unlinkSurvey(surveyId);
            setGleLink(null);
            setConfirmUnlink(false);
            toast.success("Unlinked from GLE project");
        } catch {
            toast.error("Failed to unlink");
        } finally {
            setUnlinking(false);
        }
    };

    const fetchSurvey = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const data = await surveyApi.getSurvey(surveyId, { signal });
            setSurvey(data);
            setFormData({
                redirectUrl: data.redirectUrl || "",
                overQuotaUrl: data.overQuotaUrl || "",
                securityTerminateUrl: data.securityTerminateUrl || "",
                globalQuota: data.globalQuota !== null ? String(data.globalQuota) : "",
                piiOverrideDenylist: Array.isArray(data.privacyConfig?.piiOverrideDenylist)
                    ? data.privacyConfig!.piiOverrideDenylist!.join("\n")
                    : ""
            });
        } catch (error) {
            if (signal?.aborted) return;
            toast.error("Failed to load settings");
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!survey) return;
        setSaving(true);
        try {
            const updates: Parameters<typeof surveyApi.updateSurvey>[1] = {};

            // Helper to handle empty string as null for URLs
            // Note: Zod expects null for cleared fields, not empty strings
            const getUrlValue = (val: string) => val.trim() === "" ? null : val.trim();

            const newRedirectUrl = getUrlValue(formData.redirectUrl);
            if (newRedirectUrl !== survey.redirectUrl) {
                updates.redirectUrl = newRedirectUrl;
            }

            const newOverQuotaUrl = getUrlValue(formData.overQuotaUrl);
            if (newOverQuotaUrl !== survey.overQuotaUrl) {
                updates.overQuotaUrl = newOverQuotaUrl;
            }

            const newSecurityTerminateUrl = getUrlValue(formData.securityTerminateUrl);
            if (newSecurityTerminateUrl !== survey.securityTerminateUrl) {
                updates.securityTerminateUrl = newSecurityTerminateUrl;
            }

            const newGlobalQuota = formData.globalQuota !== "" ? parseInt(formData.globalQuota) : null;
            if (newGlobalQuota !== survey.globalQuota) {
                updates.globalQuota = newGlobalQuota;
            }

            const parsedOverrides = formData.piiOverrideDenylist
                .split(/[\n,]+/)
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
            const currentOverrides = Array.isArray(survey.privacyConfig?.piiOverrideDenylist)
                ? survey.privacyConfig!.piiOverrideDenylist!
                : [];
            const changedOverrides = parsedOverrides.join("|") !== currentOverrides.join("|");
            if (changedOverrides) {
                updates.privacyConfig = {
                    ...(survey.privacyConfig || {}),
                    piiOverrideDenylist: parsedOverrides
                };
            }

            if (Object.keys(updates).length > 0) {
                await surveyApi.updateSurvey(surveyId, updates);
                toast.success("Settings saved successfully");
                if (onSave) onSave();
            } else {
                toast.info("No changes to save");
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-120 h-dvh w-screen flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90dvh]"
                        >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h3 className="text-xl font-bold">Survey Settings</h3>
                                <p className="text-xs text-muted-foreground">Configure limits and redirects for this survey.</p>
                            </div>
                            <button title="X Icon" onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
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
                                                <button title="External Link" className="p-3 hover:bg-muted rounded-xl border border-border text-muted-foreground" onClick={() => openPreview(formData.overQuotaUrl)}>
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
                                                <button title="External Link" className="p-3 hover:bg-muted rounded-xl border border-border text-muted-foreground" onClick={() => openPreview(formData.redirectUrl)}>
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
                                                <button title="External Link" className="p-3 hover:bg-muted rounded-xl border border-border text-muted-foreground" onClick={() => openPreview(formData.securityTerminateUrl)}>
                                                    <IconExternalLink size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* GLE Project Link Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                                            <IconLink size={15} className="text-muted-foreground" />
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">GLE Project</h4>
                                        </div>

                                        {gleLinkLoading || gleLink === undefined ? (
                                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 text-muted-foreground text-xs">
                                                <IconLoader2 size={12} className="animate-spin" />
                                                Checking link...
                                            </div>
                                        ) : gleLink ? (
                                            <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${confirmUnlink ? 'border-destructive/30' : 'border-primary/25 bg-primary/4'}`}>
                                                <div className="flex items-center justify-between gap-3 px-4 py-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
                                                            <IconLink size={13} className="text-primary" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-xs font-semibold text-foreground">GLE Project</span>
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide bg-primary/10 text-primary">connected</span>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{gleLink.gleProjectId}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <a
                                                            href={`${GLE_BASE}/projects/${gleLink.gleProjectId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                                        >
                                                            Open in GLE
                                                            <IconExternalLink size={10} />
                                                        </a>
                                                        {canLink && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmUnlink(!confirmUnlink)}
                                                                title="Unlink"
                                                                className={`p-1.5 rounded-lg transition-colors ${confirmUnlink ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                                            >
                                                                <IconLinkOff size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {confirmUnlink && (
                                                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-destructive/5 border-t border-destructive/15">
                                                        <span className="text-[11px] text-destructive leading-snug">Remove the link between this survey and GLE project?</span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmUnlink(false)}
                                                                className="px-2.5 py-1 text-[11px] font-medium rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleUnlink}
                                                                disabled={unlinking}
                                                                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                                                            >
                                                                {unlinking ? "Removing..." : "Unlink"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : !showGlePicker ? (
                                            <button
                                                type="button"
                                                onClick={canLink ? openGlePicker : undefined}
                                                disabled={!canLink}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed transition-all duration-150 ${canLink ? 'border-border/60 hover:border-border hover:bg-muted/30 cursor-pointer group' : 'border-border/40 cursor-default opacity-60'}`}
                                            >
                                                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <IconLink size={12} />
                                                    Not linked to a GLE project
                                                </span>
                                                {canLink && (
                                                    <span className="text-xs font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                        Link <IconChevronDown size={11} className="-rotate-90" />
                                                    </span>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="rounded-xl border border-border/60 overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/10">
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
                                                                className="w-full appearance-none bg-background border border-border rounded-xl px-3 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
                                                            >
                                                                <option value="">— Choose a project —</option>
                                                                {gleProjects.map((p) => (
                                                                    <option key={p.publicId} value={p.publicId}>
                                                                        {p.name} · {p.publicId}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <IconChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleLinkToGle}
                                                            disabled={!selectedGleProjectId || linking}
                                                            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                                        >
                                                            {linking ? "Linking..." : "Link project"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShowGlePicker(false); setSelectedGleProjectId(''); }}
                                                            className="px-3.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                                            <IconAlertTriangle size={18} className="text-amber-600" />
                                            <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">PII Overrides</h4>
                                        </div>
                                        <div className="grid gap-2">
                                            <label className="text-sm font-semibold">PII Technical ID Denylist</label>
                                            <textarea
                                                placeholder={"Enter one technical ID per line\nExample: q_email, field_phone"}
                                                className="min-h-[120px] bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-y"
                                                value={formData.piiOverrideDenylist}
                                                onChange={(e) => setFormData(prev => ({ ...prev, piiOverrideDenylist: e.target.value }))}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Any ID listed here is always treated as PII, encrypted at rest, and excluded from analytics exports.
                                            </p>
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
        </ModalPortal>
    );
}
    const openPreview = (url: string) => {
        if (!url) return;
        if (!safeOpenExternal(url)) {
            toast.error("Invalid URL. Please check and try again.");
        }
    };
