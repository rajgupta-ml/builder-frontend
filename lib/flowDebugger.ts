import type { Edge, Node } from '@xyflow/react';
import { matchesStructuredItemKey, resolveStructuredItemKey } from '@surveystudio/node-registery/logic';
import { generateRuntimeJson } from '@/lib/compiler';
import { DAGReader } from '@/src/shared/engine/DagReader';

export interface FlowDebugChoice {
    label: string;
    value: unknown;
    tone?: 'match' | 'alternate';
}

export interface FlowDebugNode {
    id: string;
    type: string;
    data: Record<string, unknown>;
}

export interface FlowDebugCondition {
    kind: 'visibility' | 'branch' | 'jump' | 'route';
    label: string;
    expression: string;
    result: string;
    fallback?: string;
}

export interface FlowDebugAdvance {
    nodeIds: string[];
    finished: boolean;
}

type LogicRule = {
    type?: string;
    field?: string;
    compareField?: string;
    operator?: string;
    value?: unknown;
    valueType?: string;
};

type LogicGroup = {
    type?: string;
    logicType?: string;
    children?: unknown[];
};

const NON_RESPONSE_TYPES = new Set([
    'start', 'end', 'branch', 'validation', 'merge', 'branchOut', 'skip',
    'image', 'video', 'audio', 'plainText',
]);

const collectRules = (value: unknown): LogicRule[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as LogicRule & { children?: unknown[] };
    if (item.type === 'rule' || (typeof item.field === 'string' && item.field)) return [item];
    return Array.isArray(item.children) ? item.children.flatMap(collectRules) : [];
};

const conditionGroups = (node: any): unknown[] => [
    node?.data?.condition,
    ...(Array.isArray(node?.skips) ? node.skips.map((skip: any) => skip?.condition) : []),
    ...(Array.isArray(node?.next?.routes) ? node.next.routes.map((route: any) => route?.condition) : []),
];

const normalizeKey = (value: unknown) => {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const optionRecords = (node: any) => Array.isArray(node?.data?.options)
    ? node.data.options.filter((option: any) => option && typeof option === 'object')
    : [];

const normalizeChoiceAlias = (value: unknown) => String(value ?? '')
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const choiceOptionMatches = (option: any, value: unknown) => (
    matchesStructuredItemKey(option, value)
    || [option?.label, option?.exportId, option?.technicalId, option?.value, option?.id]
        .some((alias) => alias !== undefined && normalizeChoiceAlias(alias) === normalizeChoiceAlias(value))
);

const stableOptionValue = (node: any, value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item) => stableOptionValue(node, item));
    const option = optionRecords(node).find((candidate: any) => choiceOptionMatches(candidate, value));
    return option
        ? resolveStructuredItemKey(option, String(option.value ?? option.id ?? value ?? ''))
        : value;
};

const optionLabel = (node: any, value: unknown): string => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value as Record<string, unknown>)
            .map(([key, itemValue]) => `${readableKey(key)}: ${optionLabel(node, itemValue)}`)
            .join(', ');
    }
    const rawValues = Array.isArray(value) ? value : [value];
    return rawValues.map((rawValue) => {
        const option = optionRecords(node).find((candidate: any) => choiceOptionMatches(candidate, rawValue));
        return String(option?.label ?? rawValue);
    }).join(', ');
};

const normalizeValue = (node: any, value: unknown) => node?.type === 'multipleChoice' && !Array.isArray(value)
    ? [value]
    : value;

const quote = (value: unknown) => `“${String(value)}”`;

const OPERATOR_LABELS: Record<string, string> = {
    equals: 'equals',
    not_equals: 'does not equal',
    contains: 'contains',
    not_contains: 'does not contain',
    gt: 'is greater than',
    lt: 'is less than',
    is_set: 'is answered',
    is_empty: 'is empty',
    is_between: 'is between',
    in_range: 'is in range',
    not_in_range: 'is not in range',
    is_postal_code: 'is a valid postal code for',
    age_matches_dob: 'matches the date of birth',
    fields_match: 'matches',
    fields_not_match: 'does not match',
    length_gte: 'has length at least',
    length_lte: 'has length at most',
    date_before_relative: 'is before',
    date_before_or_equal_relative: 'is on or before',
    date_after_relative: 'is after',
    date_after_or_equal_relative: 'is on or after',
    date_day_lt: 'has day less than',
    date_day_lte: 'has day at most',
    date_day_gt: 'has day greater than',
    date_day_gte: 'has day at least',
    date_day_eq: 'has day equal to',
    date_day_neq: 'has day not equal to',
    date_month_lt: 'has month less than',
    date_month_lte: 'has month at most',
    date_month_gt: 'has month greater than',
    date_month_gte: 'has month at least',
    date_month_eq: 'has month equal to',
    date_month_neq: 'has month not equal to',
    date_year_lt: 'has year less than',
    date_year_lte: 'has year at most',
    date_year_gt: 'has year greater than',
    date_year_gte: 'has year at least',
    date_year_eq: 'has year equal to',
    date_year_neq: 'has year not equal to',
};

const readableKey = (value: unknown) => String(value || 'matches')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const alternateValue = (node: any, target: unknown) => {
    const option = optionRecords(node).find((candidate: any) => !choiceOptionMatches(candidate, target));
    if (option) return { value: stableOptionValue(node, option.value), label: String(option.label ?? option.value) };
    const targetText = String(target ?? '').toLocaleLowerCase();
    const candidates = ['Different answer', 'Another response', '∅'];
    const value = candidates.find((candidate) => !candidate.toLocaleLowerCase().includes(targetText) && candidate.toLocaleLowerCase() !== targetText)
        || `Not ${String(target)}`;
    return { value, label: 'Another value' };
};

const addChoice = (choices: FlowDebugChoice[], node: any, choice: FlowDebugChoice) => {
    const value = normalizeValue(node, choice.value);
    if (value === undefined) return;
    if (choices.some((candidate) => normalizeKey(candidate.value) === normalizeKey(value))) return;
    choices.push({ ...choice, value });
};

const numericTarget = (value: unknown) => Number(
    value && typeof value === 'object' && 'value' in value ? (value as { value?: unknown }).value : value,
);

const addRuleChoices = (choices: FlowDebugChoice[], node: any, rule: LogicRule, responses: Record<string, unknown>) => {
    const operator = String(rule.operator || '');
    const target = stableOptionValue(node, rule.value);
    const targetLabel = optionLabel(node, target);
    const hasOptions = optionRecords(node).length > 0;
    const other = alternateValue(node, target);
    const number = numericTarget(target);

    if (operator === 'equals' || operator === 'not_equals') {
        addChoice(choices, node, { label: targetLabel, value: target, tone: operator === 'equals' ? 'match' : 'alternate' });
        addChoice(choices, node, { label: other.label, value: other.value, tone: operator === 'equals' ? 'alternate' : 'match' });
        return;
    }
    if (operator === 'contains' || operator === 'not_contains') {
        addChoice(choices, node, { label: hasOptions ? targetLabel : `Contains ${quote(targetLabel)}`, value: target, tone: operator === 'contains' ? 'match' : 'alternate' });
        addChoice(choices, node, { label: hasOptions ? other.label : `Does not contain ${quote(targetLabel)}`, value: other.value, tone: operator === 'contains' ? 'alternate' : 'match' });
        return;
    }
    if ((operator === 'gt' || operator === 'lt') && !Number.isNaN(number)) {
        const matching = operator === 'gt' ? number + 1 : number - 1;
        addChoice(choices, node, { label: operator === 'gt' ? `Above ${number}` : `Below ${number}`, value: matching, tone: 'match' });
        addChoice(choices, node, { label: operator === 'gt' ? `${number} or below` : `${number} or above`, value: number, tone: 'alternate' });
        return;
    }
    if (operator === 'is_between' && target && typeof target === 'object') {
        const min = Number((target as any).min);
        const max = Number((target as any).max);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
            addChoice(choices, node, { label: `Inside ${min}–${max}`, value: min, tone: 'match' });
            addChoice(choices, node, { label: `Outside ${min}–${max}`, value: max + 1, tone: 'alternate' });
        }
        return;
    }
    if ((operator === 'in_range' || operator === 'not_in_range') && typeof target === 'string') {
        const firstRange = target.split(',')[0]?.trim() || '';
        const startText = firstRange.split('-')[0]?.trim() || firstRange;
        const startNumber = Number(startText);
        const inside = Number.isNaN(startNumber) ? startText : startNumber;
        const outside = Number.isNaN(startNumber) ? other.value : startNumber - 1;
        addChoice(choices, node, { label: `Inside ${target}`, value: inside, tone: operator === 'in_range' ? 'match' : 'alternate' });
        addChoice(choices, node, { label: `Outside ${target}`, value: outside, tone: operator === 'in_range' ? 'alternate' : 'match' });
        return;
    }
    if (operator === 'is_set' || operator === 'is_empty') {
        addChoice(choices, node, { label: 'Has an answer', value: 'Sample answer', tone: operator === 'is_set' ? 'match' : 'alternate' });
        addChoice(choices, node, { label: 'Empty answer', value: '', tone: operator === 'is_empty' ? 'match' : 'alternate' });
        return;
    }
    if ((operator === 'length_gte' || operator === 'length_lte') && !Number.isNaN(number)) {
        const length = Math.max(0, number);
        addChoice(choices, node, { label: operator === 'length_gte' ? `At least ${length} characters` : `At most ${length} characters`, value: 'x'.repeat(length), tone: 'match' });
        addChoice(choices, node, { label: operator === 'length_gte' ? `Fewer than ${length} characters` : `More than ${length} characters`, value: 'x'.repeat(operator === 'length_gte' ? Math.max(0, length - 1) : length + 1), tone: 'alternate' });
        return;
    }
    if ((operator === 'fields_match' || operator === 'fields_not_match') && rule.compareField && rule.compareField in responses) {
        const compareValue = responses[rule.compareField];
        addChoice(choices, node, { label: 'Matches the previous answer', value: compareValue, tone: operator === 'fields_match' ? 'match' : 'alternate' });
        addChoice(choices, node, { label: 'Different from the previous answer', value: 'Different answer', tone: operator === 'fields_match' ? 'alternate' : 'match' });
    }
};

const optionToneForRules = (node: any, rules: LogicRule[], value: unknown): FlowDebugChoice['tone'] => {
    for (const rule of rules) {
        const operator = String(rule.operator || '');
        if (!['equals', 'not_equals', 'contains', 'not_contains'].includes(operator)) continue;
        const matchesTarget = normalizeKey(stableOptionValue(node, value)) === normalizeKey(stableOptionValue(node, rule.value));
        const positiveOperator = operator === 'equals' || operator === 'contains';
        return matchesTarget === positiveOperator ? 'match' : 'alternate';
    }
    return undefined;
};

export class FlowDebugger {
    private runtime: Record<string, any>;
    private reader: DAGReader;
    private rules: LogicRule[];

    constructor(nodes: Node[], edges: Edge[]) {
        this.runtime = generateRuntimeJson(nodes, edges);
        this.reader = new DAGReader(this.runtime);
        this.rules = Object.values(this.runtime).flatMap((node) => conditionGroups(node).flatMap(collectRules));
    }

    isInteractive(nodeId: string) {
        const node = this.runtime[nodeId];
        return Boolean(node && !NON_RESPONSE_TYPES.has(String(node.type)));
    }

    nodeLabel(nodeId: string) {
        const node = this.runtime[nodeId];
        return String(node?.data?.label || node?.data?.title || node?.data?.message || node?.type || nodeId || 'Question');
    }

    getNode(nodeId: string): FlowDebugNode | null {
        const node = this.runtime[nodeId];
        if (!node) return null;
        return {
            id: String(node.id || nodeId),
            type: String(node.type || ''),
            data: node.data && typeof node.data === 'object' ? node.data : {},
        };
    }

    private destinationLabel(nodeId: unknown) {
        if (typeof nodeId !== 'string' || !nodeId) return 'the next step';
        const outcome = this.outcome(nodeId);
        return outcome ? `End: ${outcome}` : this.nodeLabel(nodeId);
    }

    private formatRuleValue(rule: LogicRule) {
        if (rule.valueType === 'variable') {
            const comparedNodeId = String(rule.compareField || rule.value || '');
            return comparedNodeId ? this.nodeLabel(comparedNodeId) : 'another answer';
        }

        const value = rule.value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const record = value as Record<string, unknown>;
            if ('min' in record || 'max' in record) return `${record.min ?? '…'} and ${record.max ?? '…'}`;
            if ('amount' in record) return `${record.amount ?? 0} ${record.unit || 'days'} ago`;
            if ('value' in record) return quote(record.value);
        }

        const fieldNode = this.runtime[String(rule.field || '')];
        const label = optionLabel(fieldNode, value);
        return quote(label);
    }

    private formatCondition(value: unknown, focusNodeId?: string): string {
        if (!value || typeof value !== 'object') return 'the condition matches';
        const item = value as LogicRule & LogicGroup;
        if (item.type === 'rule' || (typeof item.field === 'string' && item.field)) {
            const subject = item.field === focusNodeId ? 'this answer' : this.nodeLabel(String(item.field || ''));
            const operator = OPERATOR_LABELS[String(item.operator || '')] || readableKey(item.operator).toLocaleLowerCase();
            if (item.operator === 'is_set' || item.operator === 'is_empty') return `${subject} ${operator}`;
            return `${subject} ${operator} ${this.formatRuleValue(item)}`;
        }

        const children = Array.isArray(item.children)
            ? item.children.map((child) => this.formatCondition(child, focusNodeId)).filter(Boolean)
            : [];
        if (children.length === 0) return 'the condition matches';
        if (children.length === 1) return children[0];
        return children.join(` ${String(item.logicType || 'AND').toUpperCase()} `);
    }

    getConditionSummaries(nodeId: string): FlowDebugCondition[] {
        const currentNode = this.runtime[nodeId];
        if (!currentNode) return [];
        const summaries: FlowDebugCondition[] = [];
        const add = (condition: unknown, item: FlowDebugCondition) => {
            if (collectRules(condition).length === 0) return;
            if (summaries.some((candidate) => candidate.label === item.label && candidate.expression === item.expression && candidate.result === item.result)) return;
            summaries.push(item);
        };

        if (collectRules(currentNode.data?.condition).length > 0) {
            add(currentNode.data.condition, {
                kind: 'visibility',
                label: 'Visibility rule',
                expression: this.formatCondition(currentNode.data.condition),
                result: `Show ${this.nodeLabel(nodeId)}`,
                fallback: `Skip ${this.nodeLabel(nodeId)}`,
            });
        }

        Object.values(this.runtime).forEach((node: any) => {
            const conditionUsesAnswer = (condition: unknown) => collectRules(condition)
                .some((rule) => rule.field === nodeId || (rule.valueType === 'variable' && (rule.compareField === nodeId || rule.value === nodeId)));

            if (node.id !== nodeId && conditionUsesAnswer(node.data?.condition)) {
                if (node.type === 'branch' || node.type === 'validation') {
                    add(node.data.condition, {
                        kind: 'branch',
                        label: node.type === 'validation' ? 'Validation condition' : 'Branch condition',
                        expression: this.formatCondition(node.data.condition, nodeId),
                        result: `Go to ${this.destinationLabel(node.next?.trueId)}`,
                        fallback: `Go to ${this.destinationLabel(node.next?.falseId)}`,
                    });
                } else {
                    add(node.data.condition, {
                        kind: 'visibility',
                        label: 'Visibility rule',
                        expression: this.formatCondition(node.data.condition, nodeId),
                        result: `Show ${this.nodeLabel(node.id)}`,
                        fallback: `Skip ${this.nodeLabel(node.id)}`,
                    });
                }
            }

            const skips = Array.isArray(node.skips) ? node.skips : [];
            skips.forEach((skip: any) => {
                if (!conditionUsesAnswer(skip?.condition)) return;
                add(skip.condition, {
                    kind: 'jump',
                    label: String(skip.label || 'Jump condition'),
                    expression: this.formatCondition(skip.condition, nodeId),
                    result: `Jump to ${this.destinationLabel(skip.targetId)}`,
                    fallback: 'Continue normally',
                });
            });

            const routes = Array.isArray(node.next?.routes) ? node.next.routes : [];
            routes.forEach((route: any) => {
                if (!conditionUsesAnswer(route?.condition)) return;
                add(route.condition, {
                    kind: 'route',
                    label: String(route.label || 'Route condition'),
                    expression: this.formatCondition(route.condition, nodeId),
                    result: `Go to ${this.destinationLabel(route.targetId)}`,
                });
            });
        });

        return summaries;
    }

    getChoices(nodeId: string, responses: Record<string, unknown>): FlowDebugChoice[] {
        const node = this.runtime[nodeId];
        if (!node) return [];
        const choices: FlowDebugChoice[] = [];
        const fieldRules = this.rules.filter((rule) => rule.field === nodeId);
        fieldRules.forEach((rule) => addRuleChoices(choices, node, rule, responses));
        optionRecords(node).forEach((option: any) => addChoice(choices, node, {
            label: String(option.label ?? option.value),
            value: stableOptionValue(node, option.value),
            tone: optionToneForRules(node, fieldRules, option.value),
        }));
        if (node.type === 'consent' && choices.length === 0) {
            addChoice(choices, node, { label: 'Agree', value: true });
            addChoice(choices, node, { label: 'Decline', value: false });
        }
        return choices.slice(0, 12);
    }

    displayValue(nodeId: string, value: unknown, preferredLabel?: string) {
        if (preferredLabel) return preferredLabel;
        const node = this.runtime[nodeId];
        if (value === '') return 'Empty answer';
        return optionLabel(node, value);
    }

    start(): FlowDebugAdvance {
        const start = this.reader.getStartNode();
        const startId = String(start.id);
        const advanced = this.advanceFrom(startId, {});
        return { nodeIds: [startId, ...advanced.nodeIds], finished: advanced.finished };
    }

    advanceFrom(nodeId: string, responses: Record<string, unknown>): FlowDebugAdvance {
        const nodeIds: string[] = [];
        const seen = new Set<string>([nodeId]);
        let currentId = nodeId;

        while (true) {
            const next = this.reader.getNextNode(currentId, responses);
            if (!next) return { nodeIds, finished: true };
            const nextId = String(next.id);
            if (seen.has(nextId)) throw new Error(`Cycle detected at ${this.nodeLabel(nextId)}.`);
            seen.add(nextId);
            nodeIds.push(nextId);
            if (next.type === 'end') return { nodeIds, finished: true };
            if (this.isInteractive(nextId)) return { nodeIds, finished: false };
            currentId = nextId;
        }
    }

    outcome(nodeId: string | undefined) {
        if (!nodeId) return null;
        const node = this.runtime[nodeId];
        if (node?.type !== 'end') return null;
        return String(node?.data?.outcome || 'Completed');
    }
}
