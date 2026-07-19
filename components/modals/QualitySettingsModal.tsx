"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconAdjustments, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { surveyResponseApi, type QualitySettings } from "@/api/surveyResponse";
import { toUserMessage } from "@/lib/api-error";

interface QualitySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onSave?: (settings: QualitySettings) => void;
}

type FormState = {
    guardrailVersion: string;
    scoreVersion: string;
    compliancePolicy: {
        duplicateDeviceTestOnly: boolean;
        duplicateDeviceLiveApprovalRecorded: boolean;
    };
    thresholds: {
        cleanMin: string;
        watchlistMin: string;
        flaggedMin: string;
    };
    scoreGroupCaps: {
        survey_speeding: string;
        question_speeding: string;
        straight_line_behavior: string;
        duplicate_identity: string;
    };
    detectors: Record<string, {
        enabled: boolean;
        scoreImpact?: string;
        severity?: string;
        expectedSurveyRatio?: string;
        minimumFloorSeconds?: string;
        expectedTimeRatio?: string;
        wordsPerSecond?: string;
        interactionFloorSeconds?: string;
        minResponses?: string;
        nearStraightLineRatio?: string;
        straightLineScoreImpact?: string;
        straightLineSeverity?: string;
        nearStraightLineScoreImpact?: string;
        nearStraightLineSeverity?: string;
        patternResponseScoreImpact?: string;
        patternResponseSeverity?: string;
    }>;
};

const toStringValue = (value: unknown) => value === undefined || value === null ? "" : String(value);
const toNumber = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const isFiniteNumberString = (value: string) => value.trim() !== "" && Number.isFinite(Number(value));

const collectValidationErrors = (form: FormState) => {
    const errors: string[] = [];

    const cleanMin = Number(form.thresholds.cleanMin);
    const watchlistMin = Number(form.thresholds.watchlistMin);
    const flaggedMin = Number(form.thresholds.flaggedMin);
    if ([cleanMin, watchlistMin, flaggedMin].every((value) => Number.isFinite(value))) {
        if (!(cleanMin > watchlistMin && watchlistMin > flaggedMin)) {
            errors.push("Thresholds must descend clean > watchlist > flagged.");
        }
    }

    const scoreVersion = form.scoreVersion.trim();
    if (!scoreVersion) {
        errors.push("Score version is required.");
    }

    const boundedZeroToOne = [
        ["Survey speeder expected ratio", form.detectors.SURVEY_SPEEDER.expectedSurveyRatio],
        ["Question speeder expected ratio", form.detectors.QUESTION_SPEEDER.expectedTimeRatio],
        ["Straight-line near ratio", form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineRatio],
    ] as const;

    for (const [label, rawValue] of boundedZeroToOne) {
        if (!rawValue || !isFiniteNumberString(rawValue)) continue;
        const value = Number(rawValue);
        if (value <= 0 || value > 1) {
            errors.push(`${label} must be greater than 0 and at most 1.`);
        }
    }

    const nonNegativeFields = [
        ["Guardrail version", form.guardrailVersion],
        ["Survey speed impact", form.detectors.SURVEY_SPEEDER.scoreImpact],
        ["Question speed impact", form.detectors.QUESTION_SPEEDER.scoreImpact],
        ["Straight-line score impact", form.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineScoreImpact],
        ["Near straight-line score impact", form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineScoreImpact],
        ["Pattern response score impact", form.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseScoreImpact],
        ["Duplicate PID score impact", form.detectors.DUPLICATE_PID.scoreImpact],
        ["Duplicate device score impact", form.detectors.DUPLICATE_DEVICE.scoreImpact],
    ] as const;

    for (const [label, rawValue] of nonNegativeFields) {
        if (!rawValue || !isFiniteNumberString(rawValue)) continue;
        if (Number(rawValue) < 0) {
            errors.push(`${label} cannot be negative.`);
        }
    }

    return errors;
};

const buildFormState = (settings: QualitySettings): FormState => ({
    guardrailVersion: toStringValue(settings.guardrailVersion),
    scoreVersion: settings.scoreVersion,
    compliancePolicy: {
        duplicateDeviceTestOnly: settings.compliancePolicy?.duplicateDeviceTestOnly ?? true,
        duplicateDeviceLiveApprovalRecorded: settings.compliancePolicy?.duplicateDeviceLiveApprovalRecorded ?? false,
    },
    thresholds: {
        cleanMin: toStringValue(settings.thresholds.cleanMin),
        watchlistMin: toStringValue(settings.thresholds.watchlistMin),
        flaggedMin: toStringValue(settings.thresholds.flaggedMin),
    },
    scoreGroupCaps: {
        survey_speeding: toStringValue(settings.scoreGroupCaps.survey_speeding ?? 25),
        question_speeding: toStringValue(settings.scoreGroupCaps.question_speeding ?? 25),
        straight_line_behavior: toStringValue(settings.scoreGroupCaps.straight_line_behavior ?? 25),
        duplicate_identity: toStringValue(settings.scoreGroupCaps.duplicate_identity ?? 25),
    },
    detectors: Object.fromEntries(Object.entries(settings.detectors).map(([key, detector]) => [key, {
        enabled: detector.enabled,
        scoreImpact: toStringValue(detector.scoreImpact),
        severity: detector.severity || "",
        expectedSurveyRatio: toStringValue(detector.expectedSurveyRatio),
        minimumFloorSeconds: toStringValue(detector.minimumFloorSeconds),
        expectedTimeRatio: toStringValue(detector.expectedTimeRatio),
        wordsPerSecond: toStringValue(detector.wordsPerSecond),
        interactionFloorSeconds: toStringValue(detector.interactionFloorSeconds),
        minResponses: toStringValue(detector.minResponses),
        nearStraightLineRatio: toStringValue(detector.nearStraightLineRatio),
        straightLineScoreImpact: toStringValue(detector.straightLineScoreImpact),
        straightLineSeverity: detector.straightLineSeverity || "",
        nearStraightLineScoreImpact: toStringValue(detector.nearStraightLineScoreImpact),
        nearStraightLineSeverity: detector.nearStraightLineSeverity || "",
        patternResponseScoreImpact: toStringValue(detector.patternResponseScoreImpact),
        patternResponseSeverity: detector.patternResponseSeverity || "",
    }])) as FormState["detectors"],
});

export function QualitySettingsModal({ isOpen, onClose, surveyId, onSave }: QualitySettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<QualitySettings | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const validationErrors = useMemo(() => form ? collectValidationErrors(form) : [], [form]);

    useEffect(() => {
        if (!isOpen || !surveyId) return;
        let cancelled = false;
        setLoading(true);
        surveyResponseApi.getQualitySettings(surveyId)
            .then((data) => {
                if (cancelled) return;
                setSettings(data);
                setForm(buildFormState(data));
            })
            .catch((error) => {
                if (cancelled) return;
                toast.error(toUserMessage(error, "Failed to load quality settings"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, surveyId]);

    const duplicateDeviceLocked = (form?.compliancePolicy.duplicateDeviceTestOnly ?? true) && !(form?.compliancePolicy.duplicateDeviceLiveApprovalRecorded ?? false);

    const updateDetector = (key: string, field: string, value: string | boolean) => {
        setForm((current) => current ? {
            ...current,
            detectors: {
                ...current.detectors,
                [key]: {
                    ...current.detectors[key],
                    [field]: value,
                },
            },
        } : current);
    };

    const handleSave = async () => {
        if (!settings || !form) return;
        if (validationErrors.length > 0) {
            toast.error(validationErrors[0]);
            return;
        }
        setSaving(true);
        try {
            const payload = {
                guardrailVersion: toNumber(form.guardrailVersion, settings.guardrailVersion || 1),
                scoreVersion: form.scoreVersion.trim() || settings.scoreVersion,
                thresholds: {
                    cleanMin: toNumber(form.thresholds.cleanMin, settings.thresholds.cleanMin),
                    watchlistMin: toNumber(form.thresholds.watchlistMin, settings.thresholds.watchlistMin),
                    flaggedMin: toNumber(form.thresholds.flaggedMin, settings.thresholds.flaggedMin),
                },
                scoreGroupCaps: {
                    survey_speeding: toNumber(form.scoreGroupCaps.survey_speeding, settings.scoreGroupCaps.survey_speeding ?? 25),
                    question_speeding: toNumber(form.scoreGroupCaps.question_speeding, settings.scoreGroupCaps.question_speeding ?? 25),
                    straight_line_behavior: toNumber(form.scoreGroupCaps.straight_line_behavior, settings.scoreGroupCaps.straight_line_behavior ?? 25),
                    duplicate_identity: toNumber(form.scoreGroupCaps.duplicate_identity, settings.scoreGroupCaps.duplicate_identity ?? 25),
                },
                detectors: {
                    SURVEY_SPEEDER: {
                        enabled: form.detectors.SURVEY_SPEEDER.enabled,
                        scoreImpact: toNumber(form.detectors.SURVEY_SPEEDER.scoreImpact || "", settings.detectors.SURVEY_SPEEDER.scoreImpact ?? 20),
                        severity: form.detectors.SURVEY_SPEEDER.severity || settings.detectors.SURVEY_SPEEDER.severity,
                        expectedSurveyRatio: toNumber(form.detectors.SURVEY_SPEEDER.expectedSurveyRatio || "", settings.detectors.SURVEY_SPEEDER.expectedSurveyRatio ?? 0.35),
                        minimumFloorSeconds: toNumber(form.detectors.SURVEY_SPEEDER.minimumFloorSeconds || "", settings.detectors.SURVEY_SPEEDER.minimumFloorSeconds ?? 30),
                    },
                    QUESTION_SPEEDER: {
                        enabled: form.detectors.QUESTION_SPEEDER.enabled,
                        scoreImpact: toNumber(form.detectors.QUESTION_SPEEDER.scoreImpact || "", settings.detectors.QUESTION_SPEEDER.scoreImpact ?? 5),
                        severity: form.detectors.QUESTION_SPEEDER.severity || settings.detectors.QUESTION_SPEEDER.severity,
                        expectedTimeRatio: toNumber(form.detectors.QUESTION_SPEEDER.expectedTimeRatio || "", settings.detectors.QUESTION_SPEEDER.expectedTimeRatio ?? 0.35),
                        wordsPerSecond: toNumber(form.detectors.QUESTION_SPEEDER.wordsPerSecond || "", settings.detectors.QUESTION_SPEEDER.wordsPerSecond ?? 3.3),
                        interactionFloorSeconds: toNumber(form.detectors.QUESTION_SPEEDER.interactionFloorSeconds || "", settings.detectors.QUESTION_SPEEDER.interactionFloorSeconds ?? 2),
                    },
                    STRAIGHT_LINE_BEHAVIOR: {
                        enabled: form.detectors.STRAIGHT_LINE_BEHAVIOR.enabled,
                        minResponses: toNumber(form.detectors.STRAIGHT_LINE_BEHAVIOR.minResponses || "", settings.detectors.STRAIGHT_LINE_BEHAVIOR.minResponses ?? 5),
                        nearStraightLineRatio: toNumber(form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineRatio || "", settings.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineRatio ?? 0.85),
                        straightLineScoreImpact: toNumber(form.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineScoreImpact || "", settings.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineScoreImpact ?? 12),
                        straightLineSeverity: form.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineSeverity || settings.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineSeverity,
                        nearStraightLineScoreImpact: toNumber(form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineScoreImpact || "", settings.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineScoreImpact ?? 6),
                        nearStraightLineSeverity: form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineSeverity || settings.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineSeverity,
                        patternResponseScoreImpact: toNumber(form.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseScoreImpact || "", settings.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseScoreImpact ?? 8),
                        patternResponseSeverity: form.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseSeverity || settings.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseSeverity,
                    },
                    DUPLICATE_PID: {
                        enabled: form.detectors.DUPLICATE_PID.enabled,
                        scoreImpact: toNumber(form.detectors.DUPLICATE_PID.scoreImpact || "", settings.detectors.DUPLICATE_PID.scoreImpact ?? 25),
                        severity: form.detectors.DUPLICATE_PID.severity || settings.detectors.DUPLICATE_PID.severity,
                    },
                    DUPLICATE_DEVICE: {
                        enabled: form.detectors.DUPLICATE_DEVICE.enabled,
                        scoreImpact: toNumber(form.detectors.DUPLICATE_DEVICE.scoreImpact || "", settings.detectors.DUPLICATE_DEVICE.scoreImpact ?? 25),
                        severity: form.detectors.DUPLICATE_DEVICE.severity || settings.detectors.DUPLICATE_DEVICE.severity,
                    },
                },
            };

            const saved = await surveyResponseApi.updateQualitySettings(surveyId, payload);
            setSettings(saved);
            setForm(buildFormState(saved));
            toast.success(`Quality settings saved as version ${saved.version ?? "new"}.`);
            onSave?.(saved);
            onClose();
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to save quality settings"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.96, opacity: 0 }}
                            className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Quality Settings</h3>
                                    <p className="text-xs text-muted-foreground">Versioned Phase 1 detector tuning for scoring and review workflows.</p>
                                </div>
                                <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-muted" title="Close quality settings">
                                    <IconX size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-6">
                                {loading || !form || !settings ? (
                                    <div className="flex justify-center py-16">
                                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="rounded-2xl border border-border bg-card p-5">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                                <IconAdjustments size={16} className="text-primary" />
                                                Active Version Summary
                                            </div>
                                            <div className="mt-3 grid gap-3 md:grid-cols-4">
                                                <Stat label="Settings Version" value={String(settings.version ?? "Draft")} />
                                                <Stat label="Guardrail Version" value={String(settings.guardrailVersion)} />
                                                <Stat label="Score Version" value={settings.scoreVersion} />
                                                <Stat label="Enabled" value={settings.isEnabled ? "Yes" : "No"} />
                                            </div>
                                        </div>

                                        <Section title="Score Metadata" description="Version labels and rollout metadata stored with future scores.">
                                            <Grid2>
                                                <NumberField label="Guardrail Version" value={form.guardrailVersion} onChange={(value) => setForm((current) => current ? { ...current, guardrailVersion: value } : current)} />
                                                <TextField label="Score Version" value={form.scoreVersion} onChange={(value) => setForm((current) => current ? { ...current, scoreVersion: value } : current)} />
                                            </Grid2>
                                        </Section>

                                        <Section title="Score Thresholds" description="Controls state transitions after the score is computed.">
                                            <Grid3>
                                                <NumberField label="Clean Min" value={form.thresholds.cleanMin} onChange={(value) => setForm((current) => current ? { ...current, thresholds: { ...current.thresholds, cleanMin: value } } : current)} />
                                                <NumberField label="Watchlist Min" value={form.thresholds.watchlistMin} onChange={(value) => setForm((current) => current ? { ...current, thresholds: { ...current.thresholds, watchlistMin: value } } : current)} />
                                                <NumberField label="Flagged Min" value={form.thresholds.flaggedMin} onChange={(value) => setForm((current) => current ? { ...current, thresholds: { ...current.thresholds, flaggedMin: value } } : current)} />
                                            </Grid3>
                                        </Section>

                                        <Section title="Score Group Caps" description="Maximum penalty per score group.">
                                            <Grid2>
                                                <NumberField label="Survey Speeding" value={form.scoreGroupCaps.survey_speeding} onChange={(value) => setForm((current) => current ? { ...current, scoreGroupCaps: { ...current.scoreGroupCaps, survey_speeding: value } } : current)} />
                                                <NumberField label="Question Speeding" value={form.scoreGroupCaps.question_speeding} onChange={(value) => setForm((current) => current ? { ...current, scoreGroupCaps: { ...current.scoreGroupCaps, question_speeding: value } } : current)} />
                                                <NumberField label="Straight Line" value={form.scoreGroupCaps.straight_line_behavior} onChange={(value) => setForm((current) => current ? { ...current, scoreGroupCaps: { ...current.scoreGroupCaps, straight_line_behavior: value } } : current)} />
                                                <NumberField label="Duplicate Identity" value={form.scoreGroupCaps.duplicate_identity} onChange={(value) => setForm((current) => current ? { ...current, scoreGroupCaps: { ...current.scoreGroupCaps, duplicate_identity: value } } : current)} />
                                            </Grid2>
                                        </Section>

                                        <DetectorSection title="Survey Speeder" enabled={form.detectors.SURVEY_SPEEDER.enabled} onToggle={(checked) => updateDetector("SURVEY_SPEEDER", "enabled", checked)}>
                                            <Grid3>
                                                <NumberField label="Score Impact" value={form.detectors.SURVEY_SPEEDER.scoreImpact || ""} onChange={(value) => updateDetector("SURVEY_SPEEDER", "scoreImpact", value)} />
                                                <TextField label="Severity" value={form.detectors.SURVEY_SPEEDER.severity || ""} onChange={(value) => updateDetector("SURVEY_SPEEDER", "severity", value.toUpperCase())} />
                                                <NumberField label="Expected Ratio" value={form.detectors.SURVEY_SPEEDER.expectedSurveyRatio || ""} onChange={(value) => updateDetector("SURVEY_SPEEDER", "expectedSurveyRatio", value)} step="0.01" />
                                                <NumberField label="Min Floor Seconds" value={form.detectors.SURVEY_SPEEDER.minimumFloorSeconds || ""} onChange={(value) => updateDetector("SURVEY_SPEEDER", "minimumFloorSeconds", value)} />
                                            </Grid3>
                                        </DetectorSection>

                                        <DetectorSection title="Question Speeder" enabled={form.detectors.QUESTION_SPEEDER.enabled} onToggle={(checked) => updateDetector("QUESTION_SPEEDER", "enabled", checked)}>
                                            <Grid3>
                                                <NumberField label="Score Impact" value={form.detectors.QUESTION_SPEEDER.scoreImpact || ""} onChange={(value) => updateDetector("QUESTION_SPEEDER", "scoreImpact", value)} />
                                                <TextField label="Severity" value={form.detectors.QUESTION_SPEEDER.severity || ""} onChange={(value) => updateDetector("QUESTION_SPEEDER", "severity", value.toUpperCase())} />
                                                <NumberField label="Expected Ratio" value={form.detectors.QUESTION_SPEEDER.expectedTimeRatio || ""} onChange={(value) => updateDetector("QUESTION_SPEEDER", "expectedTimeRatio", value)} step="0.01" />
                                                <NumberField label="Words / Second" value={form.detectors.QUESTION_SPEEDER.wordsPerSecond || ""} onChange={(value) => updateDetector("QUESTION_SPEEDER", "wordsPerSecond", value)} step="0.1" />
                                                <NumberField label="Interaction Floor Seconds" value={form.detectors.QUESTION_SPEEDER.interactionFloorSeconds || ""} onChange={(value) => updateDetector("QUESTION_SPEEDER", "interactionFloorSeconds", value)} />
                                            </Grid3>
                                        </DetectorSection>

                                        <DetectorSection title="Straight Line Behavior" enabled={form.detectors.STRAIGHT_LINE_BEHAVIOR.enabled} onToggle={(checked) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "enabled", checked)}>
                                            <Grid3>
                                                <NumberField label="Min Responses" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.minResponses || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "minResponses", value)} />
                                                <NumberField label="Near Ratio" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineRatio || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "nearStraightLineRatio", value)} step="0.01" />
                                                <NumberField label="Straight Score Impact" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineScoreImpact || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "straightLineScoreImpact", value)} />
                                                <TextField label="Straight Severity" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.straightLineSeverity || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "straightLineSeverity", value.toUpperCase())} />
                                                <NumberField label="Near Score Impact" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineScoreImpact || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "nearStraightLineScoreImpact", value)} />
                                                <TextField label="Near Severity" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.nearStraightLineSeverity || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "nearStraightLineSeverity", value.toUpperCase())} />
                                                <NumberField label="Pattern Score Impact" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseScoreImpact || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "patternResponseScoreImpact", value)} />
                                                <TextField label="Pattern Severity" value={form.detectors.STRAIGHT_LINE_BEHAVIOR.patternResponseSeverity || ""} onChange={(value) => updateDetector("STRAIGHT_LINE_BEHAVIOR", "patternResponseSeverity", value.toUpperCase())} />
                                            </Grid3>
                                        </DetectorSection>

                                        <Grid2>
                                            <DetectorSection title="Duplicate PID" enabled={form.detectors.DUPLICATE_PID.enabled} onToggle={(checked) => updateDetector("DUPLICATE_PID", "enabled", checked)}>
                                                <Grid2>
                                                    <NumberField label="Score Impact" value={form.detectors.DUPLICATE_PID.scoreImpact || ""} onChange={(value) => updateDetector("DUPLICATE_PID", "scoreImpact", value)} />
                                                    <TextField label="Severity" value={form.detectors.DUPLICATE_PID.severity || ""} onChange={(value) => updateDetector("DUPLICATE_PID", "severity", value.toUpperCase())} />
                                                </Grid2>
                                            </DetectorSection>

                                            <DetectorSection title="Duplicate Device" enabled={form.detectors.DUPLICATE_DEVICE.enabled} onToggle={(checked) => updateDetector("DUPLICATE_DEVICE", "enabled", checked)} toggleDisabled={duplicateDeviceLocked}>
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                                    {duplicateDeviceLocked
                                                        ? "Locked to test-mode runtime. Live duplicate-device rollout still requires privacy and legal approval in backend guardrails."
                                                        : "Live duplicate-device approval is recorded. Runtime enforcement still stays backend-controlled."}
                                                </div>
                                                <Grid2>
                                                    <NumberField label="Score Impact" value={form.detectors.DUPLICATE_DEVICE.scoreImpact || ""} onChange={(value) => updateDetector("DUPLICATE_DEVICE", "scoreImpact", value)} />
                                                    <TextField label="Severity" value={form.detectors.DUPLICATE_DEVICE.severity || ""} onChange={(value) => updateDetector("DUPLICATE_DEVICE", "severity", value.toUpperCase())} />
                                                </Grid2>
                                            </DetectorSection>
                                        </Grid2>
                                    </div>
                                )}
                            </div>

                            {validationErrors.length > 0 && (
                                <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
                                    <p className="font-semibold">Fix these settings before saving:</p>
                                    <ul className="mt-2 list-disc pl-5">
                                        {validationErrors.map((error) => (
                                            <li key={error}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
                                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => void handleSave()}
                                    disabled={saving || loading || !form || validationErrors.length > 0}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconDeviceFloppy size={16} />
                                    {saving ? "Saving..." : "Save New Version"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div>
                <h4 className="text-base font-semibold text-foreground">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
        </section>
    );
}

function DetectorSection({ title, enabled, onToggle, toggleDisabled, children }: { title: string; enabled: boolean; onToggle: (checked: boolean) => void; toggleDisabled?: boolean; children: React.ReactNode }) {
    return (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-foreground">{title}</h4>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={enabled} disabled={toggleDisabled} onChange={(event) => onToggle(event.target.checked)} className="h-4 w-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-60" />
                    Enabled
                </label>
            </div>
            {children}
        </section>
    );
}

function Grid2({ children }: { children: React.ReactNode }) {
    return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function Grid3({ children }: { children: React.ReactNode }) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="grid gap-2 text-sm">
            <span className="font-medium text-foreground">{label}</span>
            <input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20" />
        </label>
    );
}

function NumberField({ label, value, onChange, step }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
    return (
        <label className="grid gap-2 text-sm">
            <span className="font-medium text-foreground">{label}</span>
            <input type="number" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20" />
        </label>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
        </div>
    );
}
