import { type Node as ReactFlowNode, type Edge as ReactFlowEdge } from '@xyflow/react';

// Ghost edges visualizing skip jumps on the canvas; never persisted or compiled.
export const ANALYSIS_EDGE_ID_PREFIX = '__analysis__';
export const JUMP_EDGE_ID_PREFIX = '__jump__';
export const VISIBILITY_EDGE_ID_PREFIX = '__visibility__';
export const isGhostJumpEdge = (edge: { id?: string }): boolean =>
    String(edge?.id || '').startsWith(JUMP_EDGE_ID_PREFIX);
export const isGhostLogicEdge = (edge: { id?: string }): boolean => {
    const id = String(edge?.id || '');
    return id.startsWith(ANALYSIS_EDGE_ID_PREFIX)
        || id.startsWith(JUMP_EDGE_ID_PREFIX)
        || id.startsWith(VISIBILITY_EDGE_ID_PREFIX);
};

export interface SkipRule {
    id: string;
    label: string;
    condition: Record<string, any> | null;
    targetId: string | null;
}

export interface JumpPathInspection {
    kind: 'jump';
    sourceId: string;
    ruleId: string;
}

export interface VisibilityRuleInspection {
    kind: 'visibility';
    targetId: string;
    sourceIds: string[];
    label: string;
}

export type FlowRuleInspection = JumpPathInspection | VisibilityRuleInspection;

export const getSkipRuleKey = (rule: Pick<SkipRule, 'id'>, index: number): string => (
    typeof rule.id === 'string' && rule.id.trim().length > 0 ? rule.id : String(index)
);

export const getNodeSkipRules = (data: unknown): SkipRule[] => {
    const record = data as Record<string, any> | null | undefined;
    return Array.isArray(record?.skips)
        ? record.skips.filter((rule: unknown) => rule && typeof rule === 'object') as SkipRule[]
        : [];
};

/**
 * Converts legacy standalone skip nodes into skip rules stored on the trigger
 * question's data (`data.skips`). Handles both edge formats that existed for
 * skip nodes: the 'jump' handle, and the older 'true'/'false' handles where
 * 'false' carried the normal continue path.
 */
export const migrateSkipNodes = (
    nodes: ReactFlowNode[],
    edges: ReactFlowEdge[],
): { nodes: ReactFlowNode[]; edges: ReactFlowEdge[]; changed: boolean } => {
    const skipNodes = nodes.filter((node) => node.type === 'skip');
    if (skipNodes.length === 0) return { nodes, edges, changed: false };

    const skipIds = new Set(skipNodes.map((node) => node.id));
    const rulesBySource = new Map<string, SkipRule[]>();
    const continueEdges: ReactFlowEdge[] = [];

    skipNodes.forEach((skipNode) => {
        const incoming = edges.filter((edge) => edge.target === skipNode.id && !skipIds.has(edge.source));
        const outgoing = edges.filter((edge) => edge.source === skipNode.id);
        const jumpEdge = outgoing.find((edge) => edge.sourceHandle === 'jump')
            || outgoing.find((edge) => edge.sourceHandle === 'true')
            || outgoing.find((edge) => (edge.sourceHandle ?? null) === null);
        const falseEdges = outgoing.filter((edge) => edge.sourceHandle === 'false');
        const targetId = jumpEdge && !skipIds.has(jumpEdge.target) ? jumpEdge.target : null;

        incoming.forEach((triggerEdge) => {
            const rules = rulesBySource.get(triggerEdge.source) || [];
            rules.push({
                id: skipNode.id,
                label: String((skipNode.data as any)?.label || 'Skip rule'),
                condition: (skipNode.data as any)?.condition ?? null,
                targetId,
            });
            rulesBySource.set(triggerEdge.source, rules);

            // Legacy 'false' edge = the normal continue path of the trigger question.
            falseEdges.forEach((falseEdge) => {
                if (skipIds.has(falseEdge.target)) return;
                continueEdges.push({
                    id: `skip-continue-${triggerEdge.source}-${falseEdge.target}`,
                    source: triggerEdge.source,
                    target: falseEdge.target,
                    sourceHandle: null,
                    targetHandle: null,
                    type: 'default',
                });
            });
        });
    });

    const keptEdges = edges.filter((edge) => !skipIds.has(edge.source) && !skipIds.has(edge.target));
    const edgeKey = (edge: ReactFlowEdge) => `${edge.source}|${edge.target}|${edge.sourceHandle ?? ''}`;
    const seen = new Set(keptEdges.map(edgeKey));
    const finalEdges = [...keptEdges];

    continueEdges.forEach((edge) => {
        if (seen.has(edgeKey(edge))) return;
        const hasLinearNext = finalEdges.some((existing) =>
            existing.source === edge.source && (existing.sourceHandle ?? null) === null);
        if (hasLinearNext) return;
        seen.add(edgeKey(edge));
        finalEdges.push(edge);
    });

    const migratedNodes = nodes
        .filter((node) => node.type !== 'skip')
        .map((node) => {
            const newRules = rulesBySource.get(node.id);
            if (!newRules) return node;
            const existing = getNodeSkipRules(node.data);
            const existingIds = new Set(existing.map((rule) => rule.id));
            return {
                ...node,
                data: {
                    ...(node.data || {}),
                    skips: [...existing, ...newRules.filter((rule) => !existingIds.has(rule.id))],
                },
            };
        });

    return { nodes: migratedNodes, edges: finalEdges, changed: true };
};
