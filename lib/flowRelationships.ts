import type { Node as ReactFlowNode } from '@xyflow/react';
import {
    getNodeSkipRules,
    getSkipRuleKey,
    type FlowRuleInspection,
} from '@/lib/skipMigration';

type LogicRuleReference = {
    type?: string;
    field?: unknown;
    compareField?: unknown;
    valueType?: unknown;
    children?: unknown[];
};

export interface FlowRelationshipItem {
    nodeId: string;
    nodeLabel: string;
    ruleCount: number;
    details: string[];
    inspection: FlowRuleInspection;
}

export interface NodeFlowRelationships {
    visibilityFrom: FlowRelationshipItem[];
    visibilityTo: FlowRelationshipItem[];
    jumpsFrom: FlowRelationshipItem[];
    jumpsTo: FlowRelationshipItem[];
    visibilityRuleCount: number;
    incomingVisibilityRuleCount: number;
    incomingJumpRuleCount: number;
    outgoingJumpRuleCount: number;
    unresolvedVisibilityRuleCount: number;
    unresolvedJumpRuleCount: number;
}

const emptyRelationships = (): NodeFlowRelationships => ({
    visibilityFrom: [],
    visibilityTo: [],
    jumpsFrom: [],
    jumpsTo: [],
    visibilityRuleCount: 0,
    incomingVisibilityRuleCount: 0,
    incomingJumpRuleCount: 0,
    outgoingJumpRuleCount: 0,
    unresolvedVisibilityRuleCount: 0,
    unresolvedJumpRuleCount: 0,
});

export const flowRelationshipNodeLabel = (node: ReactFlowNode | undefined): string => {
    if (!node) return 'Missing question';
    const data = (node.data || {}) as Record<string, unknown>;
    if (node.type === 'end') {
        const outcome = String(data.outcome || '').trim();
        if (outcome) return `End: ${outcome.replace(/[_-]+/g, ' ').toLowerCase()}`;
        const message = String(data.message || '').trim();
        return message ? `End: ${message}` : 'End screen';
    }
    return String(data.label || data.title || data.message || node.type || node.id || 'Step');
};

const collectLogicRules = (value: unknown): LogicRuleReference[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as LogicRuleReference;
    if (item.type === 'rule' || (typeof item.field === 'string' && item.field)) return [item];
    return Array.isArray(item.children) ? item.children.flatMap(collectLogicRules) : [];
};

const upsertRelationship = (
    list: FlowRelationshipItem[],
    item: Omit<FlowRelationshipItem, 'ruleCount' | 'details'>,
    detail: string,
) => {
    const existing = list.find((candidate) => candidate.nodeId === item.nodeId);
    if (existing) {
        existing.ruleCount += 1;
        if (detail && !existing.details.includes(detail)) existing.details.push(detail);
        return;
    }
    list.push({ ...item, ruleCount: 1, details: detail ? [detail] : [] });
};

/**
 * Builds mirrored, display-only relationship summaries for every canvas node.
 * The returned metadata is injected into rendered nodes and is never persisted.
 */
export const buildFlowRelationships = (
    nodes: ReactFlowNode[],
): Map<string, NodeFlowRelationships> => {
    const relationships = new Map(nodes.map((node) => [node.id, emptyRelationships()]));
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    nodes.forEach((targetNode) => {
        const targetRelationships = relationships.get(targetNode.id);
        if (!targetRelationships) return;

        const visibilityRules = collectLogicRules(targetNode.data?.condition);
        targetRelationships.visibilityRuleCount = visibilityRules.length;
        visibilityRules.forEach((rule) => {
            const referencedSourceIds = new Set<string>();
            if (typeof rule.field === 'string') referencedSourceIds.add(rule.field);
            if (rule.valueType === 'variable' && typeof rule.compareField === 'string') {
                referencedSourceIds.add(rule.compareField);
            }
            const validSourceIds = [...referencedSourceIds]
                .filter((sourceId) => sourceId !== targetNode.id && nodesById.has(sourceId));
            if (validSourceIds.length === 0) {
                targetRelationships.unresolvedVisibilityRuleCount += 1;
                return;
            }

            validSourceIds.forEach((sourceId) => {
                const sourceNode = nodesById.get(sourceId);
                const sourceRelationships = relationships.get(sourceId);
                if (!sourceNode || !sourceRelationships) return;
                const sourceLabel = flowRelationshipNodeLabel(sourceNode);
                const targetLabel = flowRelationshipNodeLabel(targetNode);
                const detail = `${sourceLabel} controls when ${targetLabel} is shown`;

                upsertRelationship(targetRelationships.visibilityFrom, {
                    nodeId: sourceId,
                    nodeLabel: sourceLabel,
                    inspection: {
                        kind: 'visibility',
                        targetId: targetNode.id,
                        sourceIds: [sourceId],
                        label: detail,
                    },
                }, detail);
                upsertRelationship(sourceRelationships.visibilityTo, {
                    nodeId: targetNode.id,
                    nodeLabel: targetLabel,
                    inspection: {
                        kind: 'visibility',
                        targetId: targetNode.id,
                        sourceIds: [sourceId],
                        label: detail,
                    },
                }, detail);
                targetRelationships.incomingVisibilityRuleCount += 1;
            });
        });

    });

    nodes.forEach((sourceNode) => {
        const sourceRelationships = relationships.get(sourceNode.id);
        if (!sourceRelationships) return;
        const jumpRules = getNodeSkipRules(sourceNode.data);
        sourceRelationships.outgoingJumpRuleCount = jumpRules.length;

        jumpRules.forEach((rule, index) => {
            const targetNode = rule.targetId ? nodesById.get(rule.targetId) : undefined;
            if (!targetNode) {
                sourceRelationships.unresolvedJumpRuleCount += 1;
                return;
            }
            const targetRelationships = relationships.get(targetNode.id);
            if (!targetRelationships) return;
            const sourceLabel = flowRelationshipNodeLabel(sourceNode);
            const targetLabel = flowRelationshipNodeLabel(targetNode);
            const ruleLabel = String(rule.label || `Jump rule ${index + 1}`);
            const inspection: FlowRuleInspection = {
                kind: 'jump',
                sourceId: sourceNode.id,
                ruleId: getSkipRuleKey(rule, index),
            };

            upsertRelationship(sourceRelationships.jumpsTo, {
                nodeId: targetNode.id,
                nodeLabel: targetLabel,
                inspection,
            }, ruleLabel);
            upsertRelationship(targetRelationships.jumpsFrom, {
                nodeId: sourceNode.id,
                nodeLabel: sourceLabel,
                inspection,
            }, ruleLabel);
            targetRelationships.incomingJumpRuleCount += 1;
        });
    });

    return relationships;
};
