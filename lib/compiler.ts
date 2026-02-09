import { type Node as ReactFlowNode, type Edge as ReactFlowEdge } from '@xyflow/react';

export const generateRuntimeJson = (nodes: ReactFlowNode[], edges: ReactFlowEdge[]) => {
    const runtimeJson: Record<string, any> = {};

    // Initialize nodes
    nodes.forEach(node => {
        runtimeJson[node.id] = {
            id: node.id,
            type: node.type,
            data: node.data,
            next: node.type === 'branch'
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
                // Linear connection (take the first one found)
                sourceNode.next.nextId = edge.target;
            }
        }
    });

    return runtimeJson;
};
