"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconDeviceFloppy, IconInfoCircle, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { surveyResponseApi, type QualitySettings } from "@/api/surveyResponse";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { toUserMessage } from "@/lib/api-error";

interface QualitySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onSave?: (settings: QualitySettings) => void;
}

type FormState = {
    surveySpeedingEnabled: boolean;
    expectedLoiMinutes: string;
    surveySpeedingPercent: string;
    questionSpeedingEnabled: boolean;
    straightLiningEnabled: boolean;
    straightLiningPercent: string;
    straightLiningMinAnswers: string;
    duplicateRespondentEnabled: boolean;
    duplicateDeviceEnabled: boolean;
};

const percentString = (ratio: number | undefined, fallback: number) => String(Math.round((ratio ?? fallback) * 100));

const buildFormState = (settings: QualitySettings): FormState => ({
    surveySpeedingEnabled: settings.detectors.SURVEY_SPEEDER?.enabled ?? true,
    expectedLoiMinutes: settings.detectors.SURVEY_SPEEDER?.expectedSurveySeconds
        ? String(settings.detectors.SURVEY_SPEEDER.expectedSurveySeconds / 60)
        : "",
    surveySpeedingPercent: percentString(settings.detectors.SURVEY_SPEEDER?.expectedSurveyRatio, 0.3),
    questionSpeedingEnabled: settings.detectors.QUESTION_SPEEDER?.enabled ?? true,
    straightLiningEnabled: settings.detectors.STRAIGHT_LINE_BEHAVIOR?.enabled ?? true,
    straightLiningPercent: percentString(settings.detectors.STRAIGHT_LINE_BEHAVIOR?.nearStraightLineRatio, 0.85),
    straightLiningMinAnswers: String(settings.detectors.STRAIGHT_LINE_BEHAVIOR?.minResponses ?? 5),
    duplicateRespondentEnabled: settings.detectors.DUPLICATE_PID?.enabled ?? true,
    duplicateDeviceEnabled: settings.detectors.DUPLICATE_DEVICE?.enabled ?? false,
});

const validPercent = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 100;
};

export function QualitySettingsModal({ isOpen, onClose, surveyId, onSave }: QualitySettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<QualitySettings | null>(null);
    const [form, setForm] = useState<FormState | null>(null);

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
                if (!cancelled) toast.error(toUserMessage(error, "Failed to load quality settings"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isOpen, surveyId]);

    const validationError = useMemo(() => {
        if (!form) return null;
        const expectedLoiMinutes = Number(form.expectedLoiMinutes);
        if (form.surveySpeedingEnabled && (!Number.isFinite(expectedLoiMinutes) || expectedLoiMinutes <= 0)) return "Enter the expected survey LOI in minutes.";
        if (form.surveySpeedingEnabled && !validPercent(form.surveySpeedingPercent)) return "Survey speeding percentage must be between 1 and 100.";
        if (form.straightLiningEnabled && !validPercent(form.straightLiningPercent)) return "Straight-lining percentage must be between 1 and 100.";
        const minAnswers = Number(form.straightLiningMinAnswers);
        if (form.straightLiningEnabled && (!Number.isInteger(minAnswers) || minAnswers < 2)) return "Straight-lining needs at least 2 comparable answers.";
        return null;
    }, [form]);

    const duplicateDeviceLocked = (settings?.compliancePolicy?.duplicateDeviceTestOnly ?? true)
        && !(settings?.compliancePolicy?.duplicateDeviceLiveApprovalRecorded ?? false);

    const handleSave = async () => {
        if (!settings || !form || validationError) {
            if (validationError) toast.error(validationError);
            return;
        }

        setSaving(true);
        try {
            const saved = await surveyResponseApi.updateQualitySettings(surveyId, {
                guardrailVersion: settings.guardrailVersion,
                detectors: {
                    SURVEY_SPEEDER: {
                        enabled: form.surveySpeedingEnabled,
                        expectedSurveySeconds: form.expectedLoiMinutes ? Number(form.expectedLoiMinutes) * 60 : undefined,
                        expectedSurveyRatio: Number(form.surveySpeedingPercent) / 100,
                    },
                    QUESTION_SPEEDER: {
                        enabled: form.questionSpeedingEnabled,
                        expectedTimeRatio: settings.detectors.QUESTION_SPEEDER?.expectedTimeRatio ?? 0.35,
                        wordsPerSecond: settings.detectors.QUESTION_SPEEDER?.wordsPerSecond ?? 3.3,
                        interactionFloorSeconds: settings.detectors.QUESTION_SPEEDER?.interactionFloorSeconds ?? 2,
                    },
                    STRAIGHT_LINE_BEHAVIOR: {
                        enabled: form.straightLiningEnabled,
                        minResponses: Number(form.straightLiningMinAnswers),
                        nearStraightLineRatio: Number(form.straightLiningPercent) / 100,
                    },
                    DUPLICATE_PID: { enabled: form.duplicateRespondentEnabled },
                    DUPLICATE_DEVICE: { enabled: duplicateDeviceLocked ? false : form.duplicateDeviceEnabled },
                },
                compliancePolicy: settings.compliancePolicy,
            });
            setSettings(saved);
            setForm(buildFormState(saved));
            toast.success(`Quality rules saved as version ${saved.version ?? "new"}.`);
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
                            className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Quality Rules</h3>
                                    <p className="text-sm text-muted-foreground">Choose which checks create review findings. There are no points or penalty scores.</p>
                                </div>
                                <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-muted" title="Close quality rules">
                                    <IconX size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-6">
                                {loading || !form || !settings ? (
                                    <div className="flex justify-center py-16">
                                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                            <IconInfoCircle size={19} className="mt-0.5 shrink-0" />
                                            <p>One finding means <strong>Needs review</strong>. A duplicate respondent, a critical finding, or findings from multiple checks means <strong>High risk</strong>.</p>
                                        </div>

                                        <RuleCard
                                            title="Survey speeding"
                                            description={`Flag a response completed in less than ${form.surveySpeedingPercent || "—"}% of the expected survey time.`}
                                            enabled={form.surveySpeedingEnabled}
                                            onToggle={(enabled) => setForm({ ...form, surveySpeedingEnabled: enabled })}
                                        >
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <NumberField
                                                    label="Expected LOI"
                                                    value={form.expectedLoiMinutes}
                                                    suffix="minutes"
                                                    onChange={(expectedLoiMinutes) => setForm({ ...form, expectedLoiMinutes })}
                                                />
                                                <NumberField
                                                    label="Speeding threshold"
                                                    value={form.surveySpeedingPercent}
                                                    suffix="% of LOI"
                                                    onChange={(surveySpeedingPercent) => setForm({ ...form, surveySpeedingPercent })}
                                                />
                                            </div>
                                        </RuleCard>

                                        <RuleCard
                                            title="Question speeding"
                                            description="Flag questions answered faster than their reading time and interaction time allow. Repeated fast questions remain one type of finding."
                                            enabled={form.questionSpeedingEnabled}
                                            onToggle={(enabled) => setForm({ ...form, questionSpeedingEnabled: enabled })}
                                        />

                                        <RuleCard
                                            title="Straight lining"
                                            description={`Flag comparable answers when at least ${form.straightLiningPercent || "—"}% repeat the same choice.`}
                                            enabled={form.straightLiningEnabled}
                                            onToggle={(enabled) => setForm({ ...form, straightLiningEnabled: enabled })}
                                        >
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <NumberField
                                                    label="Same-answer threshold"
                                                    value={form.straightLiningPercent}
                                                    suffix="%"
                                                    onChange={(straightLiningPercent) => setForm({ ...form, straightLiningPercent })}
                                                />
                                                <NumberField
                                                    label="Minimum comparable answers"
                                                    value={form.straightLiningMinAnswers}
                                                    onChange={(straightLiningMinAnswers) => setForm({ ...form, straightLiningMinAnswers })}
                                                />
                                            </div>
                                        </RuleCard>

                                        <RuleCard
                                            title="Duplicate respondent"
                                            description="Mark a repeated respondent ID as high risk."
                                            enabled={form.duplicateRespondentEnabled}
                                            onToggle={(enabled) => setForm({ ...form, duplicateRespondentEnabled: enabled })}
                                        />

                                        <RuleCard
                                            title="Duplicate device"
                                            description={duplicateDeviceLocked
                                                ? "Unavailable for live surveys until privacy and legal approval is recorded."
                                                : "Create a review finding when the same approved device fingerprint appears again."}
                                            enabled={form.duplicateDeviceEnabled}
                                            onToggle={(enabled) => setForm({ ...form, duplicateDeviceEnabled: enabled })}
                                            toggleDisabled={duplicateDeviceLocked}
                                        />
                                    </div>
                                )}
                            </div>

                            {validationError && (
                                <div className="border-t border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">{validationError}</div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
                                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted">Cancel</button>
                                <button
                                    onClick={() => void handleSave()}
                                    disabled={saving || loading || !form || Boolean(validationError)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <IconDeviceFloppy size={16} />
                                    {saving ? "Saving..." : "Save Rules"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}

function RuleCard({
    title,
    description,
    enabled,
    onToggle,
    toggleDisabled = false,
    children,
}: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    toggleDisabled?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
                    <input
                        type="checkbox"
                        checked={enabled}
                        disabled={toggleDisabled}
                        onChange={(event) => onToggle(event.target.checked)}
                        className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {enabled ? "On" : "Off"}
                </label>
            </div>
            {enabled && children && <div className="mt-4 border-t border-border/70 pt-4">{children}</div>}
        </section>
    );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (value: string) => void; suffix?: string }) {
    return (
        <label className="block space-y-2 text-sm font-medium text-foreground">
            <span>{label}</span>
            <div className="flex overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary">
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                />
                {suffix && <span className="flex items-center border-l border-border bg-muted/40 px-3 text-xs text-muted-foreground">{suffix}</span>}
            </div>
        </label>
    );
}
