import React from "react";
import { Node, Edge } from "@xyflow/react";
import { IconArrowRampRight, IconPlus, IconTrash } from "@tabler/icons-react";
import { ConditionBuilder } from "./ConditionBuilder";
import type { LogicGroup } from "./conditionTypes";
import type { SkipRule } from "@/lib/skipMigration";
import { generateUniqueId } from "@/lib/utils";

interface SkipRulesBuilderProps {
    value: unknown;
    onChange: (rules: SkipRule[]) => void;
    nodes: Node[];
    edges: Edge[];
    currentNodeId: string;
    readOnly?: boolean;
}

const createEmptyCondition = (): LogicGroup => ({
    id: "root",
    type: "group",
    logicType: "AND",
    children: [],
});

const normalizeRules = (value: unknown): SkipRule[] => (
    Array.isArray(value)
        ? value.filter((rule): rule is SkipRule => Boolean(rule) && typeof rule === "object")
        : []
);

const TARGETABLE_EXCLUDED_TYPES = new Set(["start", "skip"]);

export function SkipRulesBuilder({ value, onChange, nodes, edges, currentNodeId, readOnly = false }: SkipRulesBuilderProps) {
    const rules = normalizeRules(value);

    const targetOptions = nodes
        .filter((node) => node.id !== currentNodeId && !TARGETABLE_EXCLUDED_TYPES.has(String(node.type || "")))
        .map((node) => ({
            id: node.id,
            label: String((node.data as any)?.label || node.id),
            type: String(node.type || ""),
        }));

    const commit = (nextRules: SkipRule[]) => {
        if (readOnly) return;
        onChange(nextRules);
    };

    const updateRule = (index: number, patch: Partial<SkipRule>) => {
        commit(rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule));
    };

    const removeRule = (index: number) => {
        commit(rules.filter((_, ruleIndex) => ruleIndex !== index));
    };

    const addRule = () => {
        commit([
            ...rules,
            {
                id: generateUniqueId("skip"),
                label: `Skip rule ${rules.length + 1}`,
                condition: createEmptyCondition(),
                targetId: null,
            },
        ]);
    };

    return (
        <div className="space-y-3">
            <div className="rounded-md border border-rose-200/60 bg-rose-50/50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/10">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    <IconArrowRampRight size={14} /> Skip logic
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Jump the respondent to a later question when a condition matches. Select this question on the canvas to preview its jump paths.
                </p>
            </div>

            {rules.map((rule, index) => (
                <div key={rule.id || index} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-1.5 border-b border-border bg-muted/25 p-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-500/10 text-[10px] font-bold text-rose-700">
                            {index + 1}
                        </span>
                        <input
                            type="text"
                            disabled={readOnly}
                            value={rule.label || ""}
                            onChange={(event) => updateRule(index, { label: event.target.value })}
                            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50"
                            placeholder={`Skip rule ${index + 1}`}
                        />
                        <button
                            type="button"
                            disabled={readOnly}
                            title="Remove skip rule"
                            onClick={() => removeRule(index)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            <IconTrash size={14} />
                        </button>
                    </div>
                    <div className="space-y-3 p-2.5">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">When</label>
                            <ConditionBuilder
                                value={(rule.condition as LogicGroup) || createEmptyCondition()}
                                onChange={(condition) => updateRule(index, { condition })}
                                nodes={nodes}
                                edges={edges}
                                currentNodeId={currentNodeId}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Jump to</label>
                            <select
                                disabled={readOnly}
                                value={rule.targetId || ""}
                                onChange={(event) => updateRule(index, { targetId: event.target.value || null })}
                                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select a target question…</option>
                                {targetOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.type === "end" ? `End · ${option.label}` : option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            ))}

            {!readOnly && (
                <button
                    type="button"
                    onClick={addRule}
                    className="w-full py-2 border-2 border-dashed border-border rounded-md text-xs font-medium text-muted-foreground hover:border-rose-400 hover:text-rose-600 transition-colors flex items-center justify-center gap-1"
                >
                    <IconPlus size={14} /> Add Skip Rule
                </button>
            )}
        </div>
    );
}
