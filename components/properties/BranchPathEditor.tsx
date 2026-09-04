import React, { useMemo } from "react";
import { Node, Edge } from "@xyflow/react";
import { IconArrowRight, IconGitBranch } from "@tabler/icons-react";
import { ConditionBuilder } from "./ConditionBuilder";
import type { LogicGroup, LogicRule } from "./conditionTypes";
import { getChoiceOptions } from "@/lib/choiceOptions";
import { cn, generateUniqueId } from "@/lib/utils";

interface BranchPathEditorProps {
    value: LogicGroup;
    onChange: (condition: LogicGroup) => void;
    nodes: Node[];
    edges: Edge[];
    currentNodeId: string;
    readOnly?: boolean;
}

const createEmptyCondition = (): LogicGroup => ({
    id: "root",
    type: "group",
    logicType: "OR",
    children: [],
});

// Multi-select answers are checked with "contains"; every other choice type
// (single-select, dropdown) is checked with "equals".
const operatorForSourceType = (type?: string): string => (type === "multipleChoice" ? "contains" : "equals");

const countConditionRules = (value: unknown): number => {
    if (!value || typeof value !== "object") return 0;
    const item = value as { type?: string; children?: unknown[] };
    if (item.type === "rule") return 1;
    if (!Array.isArray(item.children)) return 0;
    return item.children.reduce<number>((total, child) => total + countConditionRules(child), 0);
};

const getSelectedOptionValues = (condition: LogicGroup | undefined, sourceId: string): Set<string> => {
    const values = new Set<string>();
    const children = condition?.children ?? [];
    for (const child of children) {
        if (child.type === "rule" && child.field === sourceId && (child.operator === "equals" || child.operator === "contains")) {
            values.add(String(child.value));
        }
    }
    return values;
};

export function BranchPathEditor({ value, onChange, nodes, edges, currentNodeId, readOnly = false }: BranchPathEditorProps) {
    const sourceNode = useMemo(() => {
        const incomingEdge = edges.find((edge) => edge.target === currentNodeId);
        return incomingEdge ? nodes.find((node) => node.id === incomingEdge.source) : undefined;
    }, [edges, nodes, currentNodeId]);

    const choiceOptions = useMemo(() => (
        sourceNode ? getChoiceOptions(sourceNode.data as Record<string, unknown>) : []
    ), [sourceNode]);

    if (!sourceNode) {
        return (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Connect a question to this branch's incoming arrow on canvas to configure the True/False paths.
            </div>
        );
    }

    if (choiceOptions.length === 0) {
        const ruleCount = countConditionRules(value);
        return (
            <div className="space-y-3">
                <SourceChip node={sourceNode} />
                <p className="text-[10px] leading-4 text-muted-foreground">
                    "{String(sourceNode.data?.label || "This question")}" doesn't have a fixed option list
                    {sourceNode.type === 'matrixChoice' || sourceNode.type === 'cascadingChoice'
                        ? " with a single answer per respondent"
                        : ""}
                    , so define the True path as a rule instead of a checklist.
                </p>

                <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <div className="flex items-center gap-1.5 border-b border-emerald-200/60 px-3 py-2 dark:border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">True path</p>
                        <span className="ml-auto text-[10px] font-semibold text-emerald-700/70 dark:text-emerald-300/70">
                            {ruleCount === 0 ? "Select at least one rule" : `${ruleCount} ${ruleCount === 1 ? "rule" : "rules"}`}
                        </span>
                    </div>
                    <div className="p-2">
                        <ConditionBuilder
                            value={value || createEmptyCondition()}
                            onChange={onChange}
                            nodes={nodes}
                            edges={edges}
                            currentNodeId={currentNodeId}
                            lockedFieldId={sourceNode.id}
                        />
                    </div>
                </div>

                <div className="rounded-lg border border-red-200/60 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/10">
                    <div className="flex items-center gap-1.5 border-b border-red-200/60 px-3 py-2 dark:border-red-500/30">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <p className="text-xs font-bold text-red-800 dark:text-red-300">False path</p>
                        <span className="ml-auto text-[10px] font-semibold text-red-700/70 dark:text-red-300/70">Automatic</span>
                    </div>
                    <p className="p-2 px-3 py-2.5 text-[10px] leading-4 text-red-800/80 dark:text-red-300/80">
                        Everyone whose answer doesn't match the True path rule above.
                    </p>
                </div>
            </div>
        );
    }

    const operator = operatorForSourceType(sourceNode.type);
    const selectedValues = getSelectedOptionValues(value, sourceNode.id);

    const toggleOption = (optionValue: string, checked: boolean) => {
        if (readOnly) return;
        const otherRules = (value?.children ?? []).filter((child) => (
            !(child.type === "rule" && child.field === sourceNode.id && String(child.value) === optionValue)
        ));
        const nextRules = checked
            ? [
                ...otherRules,
                {
                    id: generateUniqueId("rule"),
                    type: "rule" as const,
                    field: sourceNode.id,
                    operator,
                    value: optionValue,
                    valueType: "static" as const,
                } satisfies LogicRule,
            ]
            : otherRules;
        onChange({ id: value?.id || "root", type: "group", logicType: "OR", children: nextRules });
    };

    const falseOptions = choiceOptions.filter((option) => !selectedValues.has(option.value));

    return (
        <div className="space-y-3">
            <SourceChip node={sourceNode} />

            <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="flex items-center gap-1.5 border-b border-emerald-200/60 px-3 py-2 dark:border-emerald-500/30">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">True path</p>
                    <span className="ml-auto text-[10px] font-semibold text-emerald-700/70 dark:text-emerald-300/70">
                        {selectedValues.size === 0 ? "Select at least one" : `${selectedValues.size} selected`}
                    </span>
                </div>
                <div className="space-y-1 p-2">
                    {choiceOptions.map((option) => (
                        <label
                            key={option.value}
                            className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-emerald-500/10",
                            )}
                        >
                            <input
                                type="checkbox"
                                disabled={readOnly}
                                checked={selectedValues.has(option.value)}
                                onChange={(event) => toggleOption(option.value, event.target.checked)}
                                className="h-3.5 w-3.5 accent-emerald-600"
                            />
                            <span className="truncate text-foreground">{option.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-red-200/60 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/10">
                <div className="flex items-center gap-1.5 border-b border-red-200/60 px-3 py-2 dark:border-red-500/30">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <p className="text-xs font-bold text-red-800 dark:text-red-300">False path</p>
                    <span className="ml-auto text-[10px] font-semibold text-red-700/70 dark:text-red-300/70">Automatic</span>
                </div>
                <div className="p-2">
                    {falseOptions.length === 0 ? (
                        <p className="px-2 py-1.5 text-[10px] italic text-red-700/70 dark:text-red-300/70">
                            Every option routes True — false path will never be reached.
                        </p>
                    ) : (
                        <p className="px-2 py-1.5 text-xs text-foreground">
                            Everyone else: <span className="font-medium">{falseOptions.map((option) => option.label).join(", ")}</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

const SourceChip = ({ node }: { node: Node }) => (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs font-medium">
        <IconGitBranch size={14} className="shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-muted-foreground">Branching on</span>
        <IconArrowRight size={12} className="shrink-0 text-muted-foreground/60" />
        <span className="min-w-0 truncate text-foreground" title={String(node.data?.label || node.id)}>
            {String(node.data?.label || node.id)}
        </span>
    </div>
);
