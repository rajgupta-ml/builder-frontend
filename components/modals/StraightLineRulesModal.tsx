"use client";

import { useEffect, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { IconDeviceFloppy, IconInfoCircle, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { cn } from "@/lib/utils";

type ComparisonRule = {
    id: string;
    label: string;
    minResponses: number;
    nearStraightLineRatio: number;
    memberIds: string[];
};

interface StraightLineRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: Node[];
    readOnly?: boolean;
    onApply: (nodes: Node[]) => void;
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

const parseRule = (value: unknown): Omit<ComparisonRule, "memberIds"> | null => {
    const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const id = text(source.id);
    const label = text(source.label);
    if (!id || !label) return null;
    const minResponses = Number(source.minResponses);
    const nearStraightLineRatio = Number(source.nearStraightLineRatio);
    return {
        id,
        label,
        minResponses: Number.isInteger(minResponses) && minResponses >= 2 ? minResponses : 8,
        nearStraightLineRatio: Number.isFinite(nearStraightLineRatio) && nearStraightLineRatio > 0 && nearStraightLineRatio <= 1
            ? nearStraightLineRatio
            : 0.9,
    };
};

const isEligibleQuestion = (node: Node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    if (node.type === "singleChoice" || node.type === "dropdown") {
        return Array.isArray(data.options) && data.options.length >= 2;
    }
    if (node.type === "rating" && data.responseMode !== "multi") {
        return Number(data.maxRating) >= 2;
    }
    if (node.type === "slider" && data.responseMode !== "multi") {
        const min = Number(data.min);
        const max = Number(data.max);
        const step = Number(data.step);
        return Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(step) && step > 0 && max > min;
    }
    return false;
};

const questionLabel = (node: Node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return text(data.questionLabel) || text(data.label) || node.id;
};

const questionTypeLabel = (node: Node) => {
    if (node.type === "singleChoice") return "Single choice";
    if (node.type === "dropdown") return "Dropdown";
    if (node.type === "rating") return "Rating";
    if (node.type === "slider") return "Slider";
    return String(node.type || "Question");
};

const deriveRules = (nodes: Node[]): ComparisonRule[] => {
    const rules = new Map<string, ComparisonRule>();
    for (const node of nodes) {
        if (!isEligibleQuestion(node)) continue;
        const parsed = parseRule((node.data as Record<string, unknown> | undefined)?.straightLiningGroup);
        if (!parsed) continue;
        const existing = rules.get(parsed.id);
        if (existing) {
            existing.memberIds.push(node.id);
        } else {
            rules.set(parsed.id, { ...parsed, memberIds: [node.id] });
        }
    }
    return Array.from(rules.values()).sort((left, right) => left.label.localeCompare(right.label));
};

const newRuleId = () => (
    typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : "straight-line-" + Date.now().toString(36)
);

const INPUT_CLASS = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

export function StraightLineRulesModal({
    isOpen,
    onClose,
    nodes,
    readOnly = false,
    onApply,
}: StraightLineRulesModalProps) {
    const eligibleQuestions = useMemo(
        () => nodes.filter(isEligibleQuestion).sort((left, right) => questionLabel(left).localeCompare(questionLabel(right))),
        [nodes],
    );
    const [rules, setRules] = useState<ComparisonRule[]>([]);
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const nextRules = deriveRules(nodes);
        setRules(nextRules);
        setSelectedRuleId((current) => nextRules.some((rule) => rule.id === current) ? current : nextRules[0]?.id ?? null);
    }, [isOpen, nodes]);

    const selectedRule = rules.find((rule) => rule.id === selectedRuleId) ?? null;

    const updateSelectedRule = (updates: Partial<ComparisonRule>) => {
        if (!selectedRuleId || readOnly) return;
        setRules((current) => current.map((rule) => rule.id === selectedRuleId ? { ...rule, ...updates } : rule));
    };

    const createRule = () => {
        if (readOnly) return;
        const id = newRuleId();
        const nextRule: ComparisonRule = {
            id,
            label: "Comparison rule " + (rules.length + 1),
            minResponses: 6,
            nearStraightLineRatio: 0.9,
            memberIds: [],
        };
        setRules((current) => [...current, nextRule]);
        setSelectedRuleId(id);
    };

    const deleteSelectedRule = () => {
        if (!selectedRuleId || readOnly) return;
        const nextRules = rules.filter((rule) => rule.id !== selectedRuleId);
        setRules(nextRules);
        setSelectedRuleId(nextRules[0]?.id ?? null);
    };

    const toggleQuestion = (nodeId: string) => {
        if (!selectedRuleId || readOnly) return;
        setRules((current) => current.map((rule) => {
            if (rule.id === selectedRuleId) {
                const included = rule.memberIds.includes(nodeId);
                return {
                    ...rule,
                    memberIds: included ? rule.memberIds.filter((id) => id !== nodeId) : [...rule.memberIds, nodeId],
                };
            }
            return { ...rule, memberIds: rule.memberIds.filter((id) => id !== nodeId) };
        }));
    };

    const validationError = useMemo(() => {
        for (const rule of rules) {
            if (!rule.label.trim()) return "Every comparison rule needs a name.";
            if (rule.memberIds.length < 2) return `${rule.label} needs at least two selected questions.`;
            if (rule.minResponses > rule.memberIds.length) {
                return `${rule.label} has a minimum answered count greater than its selected questions.`;
            }
        }
        return null;
    }, [rules]);

    const applyRules = () => {
        if (readOnly) return;
        if (validationError) {
            toast.error(validationError);
            return;
        }

        const nextNodes = nodes.map((node) => {
            const memberRule = rules.find((rule) => rule.memberIds.includes(node.id));
            const data = (node.data || {}) as Record<string, unknown>;
            if (!memberRule) {
                if (!parseRule(data.straightLiningGroup)) return node;
                return { ...node, data: { ...data, straightLiningGroup: null } };
            }
            return {
                ...node,
                data: {
                    ...data,
                    straightLiningGroup: {
                        id: memberRule.id,
                        label: memberRule.label.trim(),
                        scaleSignature: "pm-defined",
                        minResponses: memberRule.minResponses,
                        nearStraightLineRatio: memberRule.nearStraightLineRatio,
                    },
                },
            };
        });
        onApply(nextNodes);
        toast.success("Straight-line comparison rules updated.");
        onClose();
    };

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.97, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.97, opacity: 0 }}
                            className="flex h-[min(860px,92dvh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Straight-line comparison rules</h3>
                                    <p className="text-sm text-muted-foreground">The PM explicitly chooses which standalone questions are compared.</p>
                                </div>
                                <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-muted" title="Close comparison rules">
                                    <IconX size={20} />
                                </button>
                            </div>

                            <div className="flex min-h-0 flex-1">
                                <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/10">
                                    <div className="border-b border-border p-4">
                                        <button
                                            type="button"
                                            onClick={createRule}
                                            disabled={readOnly}
                                            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                                        >
                                            <IconPlus size={16} /> New comparison rule
                                        </button>
                                    </div>
                                    <div className="flex-1 space-y-1 overflow-y-auto p-2">
                                        {rules.length === 0 && (
                                            <p className="px-3 py-8 text-center text-xs text-muted-foreground">No standalone comparison rules yet.</p>
                                        )}
                                        {rules.map((rule) => (
                                            <button
                                                key={rule.id}
                                                type="button"
                                                onClick={() => setSelectedRuleId(rule.id)}
                                                className={cn(
                                                    "w-full rounded-lg px-3 py-2 text-left transition-colors",
                                                    selectedRuleId === rule.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
                                                )}
                                            >
                                                <span className="block truncate text-sm font-semibold">{rule.label}</span>
                                                <span className="text-[11px] text-muted-foreground">{rule.memberIds.length} selected question{rule.memberIds.length === 1 ? "" : "s"}</span>
                                            </button>
                                        ))}
                                    </div>
                                </aside>

                                <main className="min-w-0 flex-1 overflow-y-auto p-6">
                                    {!selectedRule ? (
                                        <div className="flex h-full items-center justify-center">
                                            <div className="max-w-md text-center">
                                                <h4 className="font-semibold text-foreground">Create a comparison rule</h4>
                                                <p className="mt-1 text-sm text-muted-foreground">Then select exactly which standalone questions belong together. Nothing is included automatically.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mx-auto max-w-3xl space-y-6">
                                            <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                                <IconInfoCircle size={19} className="mt-0.5 shrink-0" />
                                                <p>Only selected questions that were shown and answered count. Matching does not prove poor quality; it creates a review finding.</p>
                                            </div>

                                            <section className="space-y-3">
                                                <div className="flex items-end gap-3">
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="text-xs font-semibold text-foreground">Rule name</label>
                                                        <input
                                                            value={selectedRule.label}
                                                            disabled={readOnly}
                                                            onChange={(event) => updateSelectedRule({ label: event.target.value })}
                                                            className={INPUT_CLASS}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={deleteSelectedRule}
                                                        disabled={readOnly}
                                                        className="flex h-10 items-center gap-1.5 rounded-md border border-destructive/30 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                                    >
                                                        <IconTrash size={15} /> Delete
                                                    </button>
                                                </div>
                                            </section>

                                            <section className="space-y-3 rounded-xl border border-border p-4">
                                                <div>
                                                    <h4 className="text-sm font-semibold">1. Select comparable questions</h4>
                                                    <p className="mt-1 text-xs text-muted-foreground">A question can belong to one rule. Selecting it here moves it from any other rule.</p>
                                                </div>
                                                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                                                    {eligibleQuestions.map((question) => {
                                                        const assignedRule = rules.find((rule) => rule.id !== selectedRule.id && rule.memberIds.includes(question.id));
                                                        return (
                                                            <label key={question.id} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRule.memberIds.includes(question.id)}
                                                                    disabled={readOnly}
                                                                    onChange={() => toggleQuestion(question.id)}
                                                                    className="mt-0.5 h-4 w-4 accent-primary"
                                                                />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block truncate text-sm font-medium text-foreground">{questionLabel(question)}</span>
                                                                    <span className="text-[11px] text-muted-foreground">
                                                                        {questionTypeLabel(question)}
                                                                        {assignedRule ? " · currently in " + assignedRule.label : ""}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                    {eligibleQuestions.length === 0 && (
                                                        <p className="py-6 text-center text-xs text-muted-foreground">Add single-choice, dropdown, single-rating, or slider questions first.</p>
                                                    )}
                                                </div>
                                            </section>

                                            <section className="space-y-3 rounded-xl border border-border p-4">
                                                <div>
                                                    <h4 className="text-sm font-semibold">2. Set the evidence threshold</h4>
                                                    <p className="mt-1 text-xs text-muted-foreground">Answers are compared by their selected position within each PM-chosen question.</p>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <label className="space-y-1.5">
                                                        <span className="text-xs font-semibold">Minimum answered</span>
                                                        <input
                                                            type="number"
                                                            min={2}
                                                            max={Math.max(2, selectedRule.memberIds.length)}
                                                            value={selectedRule.minResponses}
                                                            disabled={readOnly}
                                                            onChange={(event) => updateSelectedRule({ minResponses: Math.max(2, Math.floor(Number(event.target.value) || 2)) })}
                                                            className={INPUT_CLASS}
                                                        />
                                                    </label>
                                                    <label className="space-y-1.5">
                                                        <span className="text-xs font-semibold">Same-answer threshold (%)</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={100}
                                                            value={Math.round(selectedRule.nearStraightLineRatio * 100)}
                                                            disabled={readOnly}
                                                            onChange={(event) => updateSelectedRule({
                                                                nearStraightLineRatio: Math.min(100, Math.max(1, Number(event.target.value) || 1)) / 100,
                                                            })}
                                                            className={INPUT_CLASS}
                                                        />
                                                    </label>
                                                </div>
                                                {selectedRule.memberIds.length < 2 && (
                                                    <p className="text-xs font-medium text-amber-700">Select at least two questions before saving.</p>
                                                )}
                                            </section>
                                        </div>
                                    )}
                                </main>
                            </div>

                            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
                                <p className="text-xs text-destructive">{validationError || ""}</p>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
                                    <button
                                        type="button"
                                        onClick={applyRules}
                                        disabled={readOnly || Boolean(validationError)}
                                        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <IconDeviceFloppy size={16} /> Save comparison rules
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}
