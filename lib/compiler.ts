import { type Node as ReactFlowNode, type Edge as ReactFlowEdge } from '@xyflow/react';

import { v4 as uuidv4 } from 'uuid'; // You'll need this

const inferResponseMode = (data: any): 'single' | 'multi' => {
    if (data?.responseMode === 'single' || data?.responseMode === 'multi') return data.responseMode;
    return Array.isArray(data?.items) && data.items.length > 0 ? 'multi' : 'single';
};

export const generateRuntimeJson = (nodes: ReactFlowNode[], edges: ReactFlowEdge[]) => {
    const runtimeJson: Record<string, any> = {};

    // Initialize nodes
    nodes.forEach(node => {
        // Deep clone the data to avoid mutations
        const nodeData = JSON.parse(JSON.stringify(node.data));
        
        // Add stable UUIDs if they don't exist
        if (!nodeData.technicalId) {
            nodeData.technicalId = uuidv4();
        }
        if (nodeData.isPii === undefined) {
            nodeData.isPii = false;
        }

        // Add stable IDs to options (for choice-based questions)
        if (["singleChoice", "multipleChoice", "dropdown", "ranking", "emojiRating"].includes(node.type as string)) {
            if (nodeData.options && Array.isArray(nodeData.options)) {
                nodeData.options = nodeData.options.map((opt: any) => ({
                    ...opt,
                    exportId: opt.exportId || uuidv4()
                }));
            }
        }

        // Handle choices in media nodes (image, video, audio)
        if (["image", "video", "audio"].includes(node.type as string)) {
            if (nodeData.choices && Array.isArray(nodeData.choices)) {
                nodeData.choices = nodeData.choices.map((opt: any) => ({
                    ...opt,
                    exportId: opt.exportId || uuidv4()
                }));
            }
        }

        // Add stable IDs to rating and slider items
        if (["rating", "slider"].includes(node.type as string)) {
            nodeData.responseMode = inferResponseMode(nodeData);
            if (nodeData.items && Array.isArray(nodeData.items)) {
                nodeData.items = nodeData.items.map((item: any) => ({
                    ...item,
                    exportId: item.exportId || uuidv4()
                }));
            }
        }

        // Add stable IDs to matrix rows and columns
        if (node.type === "matrixChoice") {
            if (nodeData.rows && Array.isArray(nodeData.rows)) {
                nodeData.rows = nodeData.rows.map((row: any) => ({
                    ...row,
                    exportId: row.exportId || uuidv4()
                }));
            }
            if (nodeData.columns && Array.isArray(nodeData.columns)) {
                nodeData.columns = nodeData.columns.map((col: any) => ({
                    ...col,
                    exportId: col.exportId || uuidv4()
                }));
            }
        }

        // Add stable IDs to cascading choice steps and options
        if (node.type === "cascadingChoice" && nodeData.steps && Array.isArray(nodeData.steps)) {
            nodeData.steps = nodeData.steps.map((step: any) => ({
                ...step,
                exportId: step.exportId || uuidv4(),
                options: step.options?.map((opt: any) => ({
                    ...opt,
                    exportId: opt.exportId || uuidv4()
                })) || []
            }));
        }

        // Add stable IDs to multiInput fields (THIS IS THE CRITICAL FIX)
        if (node.type === "multiInput" && nodeData.fields && Array.isArray(nodeData.fields)) {
            nodeData.fields = nodeData.fields.map((field: any) => ({
                ...field,
                id: field.id || uuidv4(), // Generate stable ID
                exportId: field.exportId || uuidv4()
            }));
        }

        runtimeJson[node.id] = {
            id: node.id,
            type: node.type,
            data: nodeData,
            next: (node.type === 'branch' || node.type === 'validation')
                ? { kind: 'branch', trueId: null, falseId: null }
                : { kind: 'linear', nextId: null }
        };
    });

    // Populate edges (connections)
    edges.forEach(edge => {
        const sourceNode = runtimeJson[edge.source];
        if (sourceNode) {
            if (sourceNode.next.kind === 'branch') {
                if (edge.sourceHandle === 'true') {
                    sourceNode.next.trueId = edge.target;
                } else if (edge.sourceHandle === 'false') {
                    sourceNode.next.falseId = edge.target;
                }
            } else {
                // Linear connection
                sourceNode.next.nextId = edge.target;
            }
        }
    });

    return runtimeJson;
};
