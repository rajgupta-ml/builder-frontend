import { inferQuestionResponseMode } from '@surveystudio/node-registery/logic';
import { type Node as ReactFlowNode, type Edge as ReactFlowEdge } from '@xyflow/react';
import { migrateSkipNodes, getNodeSkipRules } from '@/lib/skipMigration';

const buildBranchOutRoutes = (nodeData: Record<string, any>) => (
    Array.isArray(nodeData.routes)
        ? nodeData.routes.map((route: any, index: number) => ({
            id: String(route?.id || `path-${index + 1}`),
            label: String(route?.label || `Path ${index + 1}`),
            condition: route?.condition || null,
            targetId: null,
        }))
        : []
);

const buildNextState = (nodeType: string | undefined, nodeData: Record<string, any>) => {
    if (nodeType === 'branch' || nodeType === 'validation') {
        return { kind: 'branch', trueId: null, falseId: null };
    }

    if (nodeType === 'branchOut') {
        return { kind: 'multiBranch', routes: buildBranchOutRoutes(nodeData), fallbackId: null };
    }

    return { kind: 'linear', nextId: null };
};


export const generateRuntimeJson = (rawNodes: ReactFlowNode[], rawEdges: ReactFlowEdge[]) => {
    // Legacy drafts may still contain standalone skip nodes; fold them into node data first.
    const { nodes, edges: normalizedEdges } = migrateSkipNodes(rawNodes, rawEdges);
    const runtimeJson: Record<string, any> = {};

    // Initialize nodes
    nodes.forEach(node => {
        // Deep clone the data to avoid mutations
        const nodeData = JSON.parse(JSON.stringify(node.data));
        
        if (nodeData.isPii === undefined) {
            nodeData.isPii = false;
        }

        // Add stable IDs to options (for choice-based questions)
        if (["singleChoice", "multipleChoice", "dropdown", "ranking", "emojiRating"].includes(node.type as string)) {
            if (nodeData.options && Array.isArray(nodeData.options)) {
                nodeData.options = nodeData.options.map((opt: any) => ({
                    ...opt,
                    exportId: opt.exportId
                }));
            }
        }

        // Handle choices in media nodes (image, video, audio)
        if (["image", "video", "audio"].includes(node.type as string)) {
            if (nodeData.choices && Array.isArray(nodeData.choices)) {
                nodeData.choices = nodeData.choices.map((opt: any) => ({
                    ...opt,
                    exportId: opt.exportId
                }));
            }
        }

        // Add stable IDs to rating and slider items
        if (["rating", "slider"].includes(node.type as string)) {
            nodeData.responseMode = inferQuestionResponseMode(nodeData);
            if (nodeData.items && Array.isArray(nodeData.items)) {
                nodeData.items = nodeData.items.map((item: any) => ({
                    ...item,
                    exportId: item.exportId
                }));
            }
        }

        // Add stable IDs to matrix rows and columns
        if (node.type === "matrixChoice") {
            if (nodeData.rows && Array.isArray(nodeData.rows)) {
                nodeData.rows = nodeData.rows.map((row: any) => ({
                    ...row,
                    exportId: row.exportId
                }));
            }
            if (nodeData.columns && Array.isArray(nodeData.columns)) {
                nodeData.columns = nodeData.columns.map((col: any) => ({
                    ...col,
                    exportId: col.exportId
                }));
            }
        }

        // Add stable IDs to cascading choice steps and options
        if (node.type === "cascadingChoice" && nodeData.steps && Array.isArray(nodeData.steps)) {
            nodeData.steps = nodeData.steps.map((step: any) => ({
                ...step,
                exportId: step.exportId,
                options: step.options?.map((opt: any) => ({
                    ...opt,
                    exportId: opt.exportId
                })) || []
            }));
        }

        // Add stable IDs to multiInput fields (THIS IS THE CRITICAL FIX)
        if (node.type === "multiInput" && nodeData.fields && Array.isArray(nodeData.fields)) {
            nodeData.fields = nodeData.fields.map((field: any) => ({
                ...field,
                id: field.id,
                exportId: field.exportId
            }));
        }

        runtimeJson[node.id] = {
            id: node.id,
            type: node.type,
            data: nodeData,
            next: buildNextState(node.type, nodeData)
        };

        const skips = getNodeSkipRules(nodeData).filter((rule) =>
            typeof rule.targetId === 'string' && rule.targetId.length > 0);
        if (skips.length > 0) {
            runtimeJson[node.id].skips = skips.map((rule) => ({
                id: rule.id,
                label: rule.label || 'Skip rule',
                condition: rule.condition || null,
                targetId: rule.targetId,
            }));
        }
    });

    // Populate edges (connections)
    normalizedEdges.forEach(edge => {
        const sourceNode = runtimeJson[edge.source];
        const targetNode = runtimeJson[edge.target];
        if (!sourceNode || !targetNode) return;

        if (sourceNode.next.kind === 'branch') {
            if (edge.sourceHandle === 'true') {
                sourceNode.next.trueId = edge.target;
            } else if (edge.sourceHandle === 'false') {
                sourceNode.next.falseId = edge.target;
            }
        } else if (sourceNode.next.kind === 'multiBranch') {
            if (edge.sourceHandle === 'fallback') {
                sourceNode.next.fallbackId = edge.target;
            } else {
                const route = sourceNode.next.routes.find((candidate: any) => candidate.id === edge.sourceHandle);
                if (route) route.targetId = edge.target;
            }
        } else {
            // Linear connection
            sourceNode.next.nextId = edge.target;
        }
    });

    return runtimeJson;
};
