import React, { useEffect, useState } from "react";
import { Node, Edge } from "@xyflow/react";
import { IconArrowRampRight, IconArrowRight, IconChevronDown, IconEye, IconPlus, IconTrash } from "@tabler/icons-react";
import { ConditionBuilder } from "./ConditionBuilder";
import type { LogicGroup, LogicRule } from "./conditionTypes";
import { getSkipRuleKey, type FlowRuleInspection, type SkipRule, type VisibilityRuleInspection } from "@/lib/skipMigration";
import { cn, generateUniqueId } from "@/lib/utils";
import { buildEndNodeSequence } from "@/lib/endNodeSequence";

interface SkipRulesBuilderProps {
    value: unknown;
    onChange: (rules: SkipRule[]) => void;
    condition?: unknown;
    onConditionChange?: (condition: LogicGroup) => void;
    nodes: Node[];
    edges: Edge[];
    currentNodeId: string;
    nodeType?: string;
    nodeData?: Record<string, unknown>;
    onInspectRule?: (inspection: FlowRuleInspection | null) => void;
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

const normalizeCondition = (value: unknown): LogicGroup => {
    if (value && typeof value === "object") {
        const item = value as Record<string, unknown>;
        if (item.type === "group" && Array.isArray(item.children)) return item as unknown as LogicGroup;
        if (typeof item.field === "string" && item.field) {
            const legacyRule: LogicRule = {
                ...(item as Omit<LogicRule, "id" | "type" | "field" | "operator" | "valueType">),
                id: typeof item.id === "string" ? item.id : "legacy-rule",
                type: "rule",
                field: item.field,
                operator: typeof item.operator === "string" ? item.operator : "equals",
                value: item.value ?? "",
                valueType: item.valueType === "variable" ? "variable" : "static",
            };
            return { ...createEmptyCondition(), children: [legacyRule] };
        }
    }
    return createEmptyCondition();
};

const countConditionRules = (value: unknown): number => {
    if (!value || typeof value !== "object") return 0;
    const item = value as { type?: string; field?: unknown; children?: unknown[] };
    if (item.type === "rule" || (typeof item.field === "string" && item.field)) return 1;
    if (!Array.isArray(item.children)) return 0;
    return item.children.reduce<number>((total, child) => total + countConditionRules(child), 0);
};

const NON_TARGETABLE_SKIP_TYPES = new Set(["start", "branch", "skip", "validation", "merge", "branchOut"]);

const getNodeY = (node?: Node): number | null => {
    const y = (node as any)?.position?.y;
    return typeof y === "number" && Number.isFinite(y) ? y : null;
};

const isAllowedSkipTarget = (node: Node, currentNodeId: string, currentY: number | null): boolean => {
    if (node.id === currentNodeId) return false;
    if (NON_TARGETABLE_SKIP_TYPES.has(String(node.type || ""))) return false;

    const targetY = getNodeY(node);
    if (currentY !== null && targetY !== null && targetY <= currentY) return false;

    return true;
};

type ChoiceOption = { label: string; value: string };

const titleCase = (value: string): string => value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getOptionValue = (option: unknown): string => {
    const record = option as Record<string, unknown> | null;
    return String(record?.value || "").trim();
};

const getChoiceOptions = (data?: Record<string, unknown>): ChoiceOption[] => {
    const options = Array.isArray(data?.options) ? data.options : [];
    const baseOptions = options
        .map((option) => {
            const record = option as Record<string, unknown>;
            const value = getOptionValue(record);
            if (!value) return null;
            return { label: String(record.label || value), value };
        })
        .filter((option): option is ChoiceOption => Boolean(option));

    if (data?.allowOther) {
        baseOptions.push({ label: String(data.otherLabel || "Other"), value: "other" });
    }
    if (data?.allowNone) {
        baseOptions.push({ label: String(data.noneLabel || "None of these"), value: "none" });
    }

    return baseOptions;
};

const getTargetBaseLabel = (node: Node, endSequence: Map<string, number>): string => {
    const data = (node.data || {}) as Record<string, unknown>;
    if (node.type === "end") {
        const seq = endSequence.get(node.id);
        const prefix = seq ? seq + ". " : "";
        const outcome = String(data.outcome || "").trim();
        if (outcome) return prefix + "End: " + titleCase(outcome);
        const message = String(data.message || "").trim();
        if (message) return prefix + "End: " + message;
        return prefix + "End";
    }
    return String(data.label || node.id);
};

const getTargetOptions = (nodes: Node[], currentNodeId: string, currentY: number | null) => {
    const allowedNodes = nodes
        .filter((node) => isAllowedSkipTarget(node, currentNodeId, currentY))
        .sort((a, b) => Number(a.type === "end") - Number(b.type === "end"));
    const endSequence = buildEndNodeSequence(nodes);
    const baseCounts = allowedNodes.reduce<Record<string, number>>((counts, node) => {
        const label = getTargetBaseLabel(node, endSequence);
        counts[label] = (counts[label] || 0) + 1;
        return counts;
    }, {});

    return allowedNodes.map((node) => {
        const baseLabel = getTargetBaseLabel(node, endSequence);
        const label = baseCounts[baseLabel] > 1 ? baseLabel + " - " + node.id.slice(-6) : baseLabel;
        return { id: node.id, label, type: String(node.type || "") };
    });
};

const collectLogicRules = (value: unknown): LogicRule[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as { type?: string; field?: unknown; children?: unknown[] };
    if (item.type === "rule" || (typeof item.field === "string" && item.field)) {
        return [item as unknown as LogicRule];
    }
    return Array.isArray(item.children) ? item.children.flatMap(collectLogicRules) : [];
};

const VISIBILITY_OPERATOR_LABELS: Record<string, string> = {
    equals: "=",
    notEquals: "≠",
    contains: "contains",
    notContains: "does not contain",
    greaterThan: ">",
    greaterThanOrEqual: "≥",
    lessThan: "<",
    lessThanOrEqual: "≤",
    isEmpty: "is empty",
    isNotEmpty: "is not empty",
};

const getVisibilityInspection = (
    value: unknown,
    nodes: Node[],
    targetId: string,
): VisibilityRuleInspection | null => {
    const rules = collectLogicRules(value);
    if (rules.length === 0) return null;
    const nodeIds = new Set(nodes.map((node) => node.id));
    const endSequence = buildEndNodeSequence(nodes);
    const sourceIds = [...new Set(rules
        .flatMap((rule) => [rule.field, rule.valueType === "variable" ? rule.compareField : undefined])
        .filter((id): id is string => Boolean(id) && id !== targetId && nodeIds.has(String(id))))];
    const firstRule = rules[0];
    const sourceNode = nodes.find((node) => node.id === firstRule.field);
    const sourceLabel = sourceNode ? getTargetBaseLabel(sourceNode, endSequence) : "Answer";
    const operator = VISIBILITY_OPERATOR_LABELS[firstRule.operator] || titleCase(firstRule.operator || "matches");
    const rawValue = firstRule.valueType === "variable"
        ? nodes.find((node) => node.id === firstRule.compareField)?.data?.label || "another answer"
        : firstRule.value;
    const valueLabel = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue ?? "").trim();
    const label = rules.length === 1
        ? [sourceLabel, operator, valueLabel].filter(Boolean).join(" ")
        : rules.length + " display conditions";
    return { kind: "visibility", targetId, sourceIds, label };
};

const getSingleChoiceOptionValue = (rule: SkipRule, currentNodeId: string): string | null => {
    const condition = normalizeCondition(rule.condition);
    if (condition.logicType !== "AND" || condition.children.length !== 1) return null;
    const child = condition.children[0] as LogicRule | undefined;
    if (!child || child.type !== "rule") return null;
    if (child.field !== currentNodeId || child.operator !== "equals" || child.valueType === "variable") return null;
    return typeof child.value === "string" && child.value ? child.value : null;
};

const createOptionCondition = (currentNodeId: string, optionValue: string): LogicGroup => ({
    id: generateUniqueId("group"),
    type: "group",
    logicType: "AND",
    children: [{
        id: generateUniqueId("rule"),
        type: "rule",
        field: currentNodeId,
        operator: "equals",
        value: optionValue,
        valueType: "static",
    }],
});

export function SkipRulesBuilder({
    value,
    onChange,
    condition,
    onConditionChange,
    nodes,
    edges,
    currentNodeId,
    nodeType,
    nodeData,
    onInspectRule,
    readOnly = false,
}: SkipRulesBuilderProps) {
    const rules = normalizeRules(value);
    const [visibilityDraftOpen, setVisibilityDraftOpen] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [optionRouteDraftOpen, setOptionRouteDraftOpen] = useState(false);
    const [optionRouteDraftValue, setOptionRouteDraftValue] = useState("");
    const visibilityRuleCount = countConditionRules(condition);
    const showVisibilityRule = visibilityRuleCount > 0 || visibilityDraftOpen;
    const flowActionCount = (showVisibilityRule ? 1 : 0) + rules.length;

    useEffect(() => {
        setVisibilityDraftOpen(false);
        setAddMenuOpen(false);
        setOptionRouteDraftOpen(false);
        setOptionRouteDraftValue("");
        onInspectRule?.(null);
    }, [currentNodeId, onInspectRule]);

    const currentNode = nodes.find((node) => node.id === currentNodeId);
    const currentY = getNodeY(currentNode);
    const targetOptions = getTargetOptions(nodes, currentNodeId, currentY);

    const defaultEdge = edges.find((edge) => edge.source === currentNodeId && (edge.sourceHandle ?? null) === null)
        || edges.find((edge) => edge.source === currentNodeId);
    const defaultTarget = nodes.find((node) => node.id === defaultEdge?.target);
    const defaultTargetLabel = defaultTarget
        ? getTargetBaseLabel(defaultTarget, buildEndNodeSequence(nodes))
        : "the connected next step";

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

    const flowInspectionHandlers = (inspection: FlowRuleInspection) => ({
        tabIndex: 0,
        onClick: () => onInspectRule?.(inspection),
        onMouseEnter: () => onInspectRule?.(inspection),
        onMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => {
            const focusedElement = typeof document !== "undefined" ? document.activeElement : null;
            if (!focusedElement || !event.currentTarget.contains(focusedElement)) onInspectRule?.(null);
        },
        onFocusCapture: () => onInspectRule?.(inspection),
        onBlurCapture: (event: React.FocusEvent<HTMLDivElement>) => {
            const nextTarget = event.relatedTarget as HTMLElement | null;
            if (!nextTarget || !event.currentTarget.contains(nextTarget)) onInspectRule?.(null);
        },
    });

    const inspectionHandlers = (rule: SkipRule, index: number) => flowInspectionHandlers({
        kind: "jump",
        sourceId: currentNodeId,
        ruleId: getSkipRuleKey(rule, index),
    });
    const visibilityInspection = getVisibilityInspection(condition, nodes, currentNodeId);
    const visibilityInspectionHandlers = visibilityInspection
        ? flowInspectionHandlers(visibilityInspection)
        : {};

    const addDestinationRule = () => {
        commit([
            ...rules,
            {
                id: generateUniqueId("skip"),
                label: "Conditional destination " + (rules.length + 1),
                condition: createEmptyCondition(),
                targetId: null,
            },
        ]);
        setAddMenuOpen(false);
    };

    const addVisibilityRule = () => {
        setVisibilityDraftOpen(true);
        setAddMenuOpen(false);
    };

    const removeVisibilityRule = () => {
        onConditionChange?.(createEmptyCondition());
        setVisibilityDraftOpen(false);
    };

    const choiceOptions = nodeType === "singleChoice" ? getChoiceOptions(nodeData) : [];
    const optionRuleEntries = rules
        .map((rule, index) => ({ rule, index, optionValue: getSingleChoiceOptionValue(rule, currentNodeId) }))
        .filter((entry): entry is { rule: SkipRule; index: number; optionValue: string } => Boolean(entry.optionValue));
    const optionValues = new Set(choiceOptions.map((option) => option.value));
    const optionRuleByValue = new Map<string, SkipRule>();
    const primaryOptionRules = new Set<SkipRule>();
    optionRuleEntries.forEach((entry) => {
        if (!optionValues.has(entry.optionValue) || optionRuleByValue.has(entry.optionValue)) return;
        optionRuleByValue.set(entry.optionValue, entry.rule);
        primaryOptionRules.add(entry.rule);
    });
    const advancedRules = rules.filter((rule) => !primaryOptionRules.has(rule));

    const changeOptionRouteAnswer = (route: SkipRule, optionValue: string) => {
        const option = choiceOptions.find((candidate) => candidate.value === optionValue);
        if (!option) return;
        const remainingRules = rules.filter((rule) => (
            rule !== route && getSingleChoiceOptionValue(rule, currentNodeId) !== optionValue
        ));
        commit([
            ...remainingRules,
            {
                ...route,
                label: option.label,
                condition: createOptionCondition(currentNodeId, option.value),
            },
        ]);
    };

    const changeOptionRouteTarget = (route: SkipRule, targetId: string) => {
        commit(rules.map((rule) => rule === route ? { ...rule, targetId: targetId || null } : rule));
    };

    const removeOptionRoute = (route: SkipRule) => {
        commit(rules.filter((rule) => rule !== route));
    };

    const addOptionRoute = (targetId: string) => {
        const option = choiceOptions.find((candidate) => candidate.value === optionRouteDraftValue);
        if (!option || !targetId) return;
        const remainingRules = rules.filter((rule) => getSingleChoiceOptionValue(rule, currentNodeId) !== option.value);
        commit([
            ...remainingRules,
            {
                id: generateUniqueId("skip"),
                label: option.label,
                condition: createOptionCondition(currentNodeId, option.value),
                targetId,
            },
        ]);
        setOptionRouteDraftOpen(false);
        setOptionRouteDraftValue("");
    };

    if (nodeType === "singleChoice" && choiceOptions.length > 0) {
        const configuredRoutes = choiceOptions.flatMap((option) => {
            const route = optionRuleByValue.get(option.value);
            return route ? [{ option, route }] : [];
        });
        const usedOptionValues = new Set(configuredRoutes.map(({ option }) => option.value));
        const availableDraftOptions = choiceOptions.filter((option) => !usedOptionValues.has(option.value));
        const singleChoiceRuleCount = configuredRoutes.length + (showVisibilityRule ? 1 : 0);

        return (
            <div className="space-y-4">
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">Default flow</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                        <span className="flex shrink-0 items-center gap-1.5">
                            <IconEye size={14} className="text-muted-foreground" /> Show question
                        </span>
                        <IconArrowRight size={14} className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate" title={defaultTargetLabel}>Follow connected flow</span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-foreground">Flow rules</h3>
                    <span className="text-[10px] text-muted-foreground">
                        {singleChoiceRuleCount === 0 ? "No rules" : singleChoiceRuleCount + (singleChoiceRuleCount === 1 ? " rule" : " rules")}
                    </span>
                </div>

                {showVisibilityRule && onConditionChange && (
                    <div
                        {...visibilityInspectionHandlers}
                        className="overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-cyan-400 focus-within:border-cyan-400"
                    >
                        <div className="flex items-center gap-2 border-b border-border bg-muted/25 px-2.5 py-2">
                            <IconEye size={14} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">Show question only when</span>
                            <button
                                type="button"
                                disabled={readOnly}
                                title="Remove show condition"
                                onClick={removeVisibilityRule}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-35"
                            >
                                <IconTrash size={14} />
                            </button>
                        </div>
                        <div className="p-2.5">
                            <ConditionBuilder
                                value={normalizeCondition(condition)}
                                onChange={onConditionChange}
                                nodes={nodes}
                                edges={edges}
                                currentNodeId={currentNodeId}
                            />
                        </div>
                    </div>
                )}

                {configuredRoutes.map(({ option, route }) => {
                    const ruleIndex = rules.indexOf(route);
                    return (
                    <div
                        key={route.id || option.value}
                        {...inspectionHandlers(route, ruleIndex)}
                        className="overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-violet-400 focus-within:border-violet-400"
                    >
                        <div className="flex items-center gap-2 border-b border-border bg-muted/25 px-2.5 py-2">
                            <IconArrowRampRight size={14} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">Jump to another question when</span>
                            <button
                                type="button"
                                disabled={readOnly}
                                title="Remove jump rule"
                                onClick={() => removeOptionRoute(route)}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-35"
                            >
                                <IconTrash size={14} />
                            </button>
                        </div>
                        <div className="space-y-2 p-2.5">
                            <label className="block space-y-1">
                                <span className="text-[10px] font-medium text-muted-foreground">Answer is</span>
                                <select
                                    disabled={readOnly}
                                    value={option.value}
                                    onChange={(event) => changeOptionRouteAnswer(route, event.target.value)}
                                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {choiceOptions.map((candidate) => (
                                        <option
                                            key={candidate.value}
                                            value={candidate.value}
                                            disabled={candidate.value !== option.value && usedOptionValues.has(candidate.value)}
                                        >
                                            {candidate.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-[10px] font-medium text-muted-foreground">Jump to</span>
                                <select
                                    disabled={readOnly}
                                    value={route.targetId || ""}
                                    onChange={(event) => changeOptionRouteTarget(route, event.target.value)}
                                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Select a destination...</option>
                                    {targetOptions.map((target) => (
                                        <option key={target.id} value={target.id}>{target.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                    );
                })}

                {optionRouteDraftOpen && (
                    <div className="overflow-hidden rounded-md border border-primary/40 bg-card">
                        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-2.5 py-2">
                            <IconArrowRampRight size={14} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">Jump to another question when</span>
                            <button
                                type="button"
                                title="Cancel jump rule"
                                onClick={() => {
                                    setOptionRouteDraftOpen(false);
                                    setOptionRouteDraftValue("");
                                }}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <IconTrash size={14} />
                            </button>
                        </div>
                        <div className="space-y-2 p-2.5">
                            <label className="block space-y-1">
                                <span className="text-[10px] font-medium text-muted-foreground">Answer is</span>
                                <select
                                    value={optionRouteDraftValue}
                                    onChange={(event) => setOptionRouteDraftValue(event.target.value)}
                                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Select an answer...</option>
                                    {availableDraftOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-[10px] font-medium text-muted-foreground">Jump to</span>
                                <select
                                    disabled={!optionRouteDraftValue}
                                    value=""
                                    onChange={(event) => addOptionRoute(event.target.value)}
                                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Select a destination...</option>
                                    {targetOptions.map((target) => (
                                        <option key={target.id} value={target.id}>{target.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                )}

                {advancedRules.length > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        <span>{advancedRules.length} old {advancedRules.length === 1 ? "rule needs" : "rules need"} cleanup.</span>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => commit(rules.filter((rule) => primaryOptionRules.has(rule)))}
                                className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                )}

                {!readOnly && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setAddMenuOpen((open) => !open)}
                            aria-expanded={addMenuOpen}
                            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                        >
                            <IconPlus size={14} /> Add flow rule
                            <IconChevronDown size={13} className={cn("transition-transform", addMenuOpen && "rotate-180")} />
                        </button>
                        {addMenuOpen && (
                            <div className="mt-2 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
                                <button
                                    type="button"
                                    disabled={showVisibilityRule || !onConditionChange}
                                    onClick={addVisibilityRule}
                                    className="flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <IconEye size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0">
                                        <span className="block text-xs font-medium text-foreground">Show question only when...</span>
                                        <span className="block text-[10px] text-muted-foreground">Control whether this question appears.</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    disabled={optionRouteDraftOpen || availableDraftOptions.length === 0}
                                    onClick={() => {
                                        setOptionRouteDraftOpen(true);
                                        setOptionRouteDraftValue("");
                                        setAddMenuOpen(false);
                                    }}
                                    className="flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <IconArrowRampRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0">
                                        <span className="block text-xs font-medium text-foreground">Jump to another question when...</span>
                                        <span className="block text-[10px] text-muted-foreground">Route a selected answer to a later question.</span>
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground">Default flow</p>
                <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                    <span className="flex shrink-0 items-center gap-1.5">
                        <IconEye size={14} className="text-muted-foreground" /> Show question
                    </span>
                    <IconArrowRight size={14} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate" title={defaultTargetLabel}>Continue to {defaultTargetLabel}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
                    Flow rules can change this behavior when their conditions match.
                </p>
            </div>

            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Flow rules</h3>
                <span className="text-[10px] text-muted-foreground">
                    {flowActionCount === 0 ? "No rules" : flowActionCount + (flowActionCount === 1 ? " rule" : " rules")}
                </span>
            </div>

            {flowActionCount === 0 && (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
                    <p className="text-[11px] font-medium text-foreground">No conditional flow</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">The default flow above will always be used.</p>
                </div>
            )}

            {showVisibilityRule && onConditionChange && (
                <div
                    {...visibilityInspectionHandlers}
                    className="overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-cyan-400 focus-within:border-cyan-400"
                >
                    <div className="flex items-center gap-2 border-b border-border bg-muted/25 px-2.5 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">1</span>
                        <IconEye size={14} className="shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">Show only when</span>
                        <button
                            type="button"
                            disabled={readOnly}
                            title="Remove visibility rule"
                            onClick={removeVisibilityRule}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-35"
                        >
                            <IconTrash size={14} />
                        </button>
                    </div>
                    <div className="p-2.5">
                        <ConditionBuilder
                            value={normalizeCondition(condition)}
                            onChange={onConditionChange}
                            nodes={nodes}
                            edges={edges}
                            currentNodeId={currentNodeId}
                        />
                    </div>
                </div>
            )}

            {rules.map((rule, index) => {
                const displayIndex = index + (showVisibilityRule ? 2 : 1);
                return (
                    <div
                        key={rule.id || index}
                        {...inspectionHandlers(rule, index)}
                        className="overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-violet-400 focus-within:border-violet-400"
                    >
                        <div className="flex items-center gap-2 border-b border-border bg-muted/25 px-2.5 py-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{displayIndex}</span>
                            <IconArrowRampRight size={14} className="shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">Go to another question</span>
                            <button
                                type="button"
                                disabled={readOnly}
                                title="Remove destination rule"
                                onClick={() => removeRule(index)}
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-35"
                            >
                                <IconTrash size={14} />
                            </button>
                        </div>
                        <div className="space-y-3 p-2.5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-muted-foreground">Go to</label>
                                <select
                                    disabled={readOnly}
                                    value={rule.targetId || ""}
                                    onChange={(event) => updateRule(index, { targetId: event.target.value || null })}
                                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">Select a destination...</option>
                                    {targetOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-muted-foreground">When</label>
                                <ConditionBuilder
                                    value={normalizeCondition(rule.condition)}
                                    onChange={(nextCondition) => updateRule(index, { condition: nextCondition })}
                                    nodes={nodes}
                                    edges={edges}
                                    currentNodeId={currentNodeId}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}

            {!readOnly && (
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setAddMenuOpen((open) => !open)}
                        aria-expanded={addMenuOpen}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                        <IconPlus size={14} /> Add flow rule
                        <IconChevronDown size={13} className={cn("transition-transform", addMenuOpen && "rotate-180")} />
                    </button>
                    {addMenuOpen && (
                        <div className="mt-2 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
                            <button
                                type="button"
                                disabled={showVisibilityRule || !onConditionChange}
                                onClick={addVisibilityRule}
                                className="flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <IconEye size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                    <span className="block text-xs font-medium text-foreground">Show only when</span>
                                    <span className="block text-[10px] text-muted-foreground">Control whether this question appears.</span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={addDestinationRule}
                                className="flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-muted"
                            >
                                <IconArrowRampRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                    <span className="block text-xs font-medium text-foreground">Go to another question</span>
                                    <span className="block text-[10px] text-muted-foreground">Choose a destination after this answer.</span>
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
