import { Node, Edge } from '@xyflow/react';

interface ValidationError {
    type: 'error' | 'warning';
    message: string;
    nodeId?: string;
}

export const validateWorkflow = (nodes: Node[], edges: Edge[]): { isValid: boolean, errors: ValidationError[] } => {
    const errors: ValidationError[] = [];

    // 1. Structural Checks: Start and End Nodes
    const startNodes = nodes.filter(n => n.type === 'start');
    const endNodes = nodes.filter(n => n.type === 'end');

    if (startNodes.length === 0) {
        errors.push({ type: 'error', message: 'The flow must have exactly one Start node.' });
    } else if (startNodes.length > 1) {
        errors.push({ type: 'error', message: 'The flow has multiple Start nodes. Only one is allowed.' });
    }

    if (endNodes.length === 0) {
        errors.push({ type: 'error', message: 'The flow must have at least one End node.' });
    }

    // 2. Build Adjacency List and In-Degree for Topological Sort
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    nodes.forEach(n => {
        adj[n.id] = [];
        inDegree[n.id] = 0;
    });

    edges.forEach(e => {
        if (adj[e.source] && adj[e.target] !== undefined) {
            adj[e.source].push(e.target);
            inDegree[e.target]++;
        }
    });

    // 3. Cycle Detection and Topological Sort (Kahn's Algorithm)
    const queue: string[] = [];
    Object.keys(inDegree).forEach(id => {
        if (inDegree[id] === 0) queue.push(id);
    });

    const topoOrder: string[] = [];
    while (queue.length > 0) {
        const u = queue.shift()!;
        topoOrder.push(u);
        adj[u].forEach(v => {
            inDegree[v]--;
            if (inDegree[v] === 0) queue.push(v);
        });
    }

    if (topoOrder.length < nodes.length) {
        errors.push({ type: 'error', message: 'The flow contains a cycle (loop). Remove loops to publish.' });
    }

    // 4. Reachability from Start
    if (startNodes.length === 1) {
        const reachable = new Set<string>();
        const stack = [startNodes[0].id];
        while (stack.length > 0) {
            const u = stack.pop()!;
            if (!reachable.has(u)) {
                reachable.add(u);
                adj[u].forEach(v => stack.push(v));
            }
        }

        nodes.forEach(node => {
            if (!reachable.has(node.id)) {
                errors.push({ type: 'error', message: `Node '${node.data.label || node.id}' is not reachable from the Start node.`, nodeId: node.id });
            }
        });
    }

    // 5. Dead-end Detection (Every node must reach an End node)
    const reverseAdj: Record<string, string[]> = {};
    nodes.forEach(n => reverseAdj[n.id] = []);
    edges.forEach(e => {
        if (reverseAdj[e.target]) reverseAdj[e.target].push(e.source);
    });

    const canReachEnd = new Set<string>();
    const endStack = endNodes.map(n => n.id);
    while (endStack.length > 0) {
        const u = endStack.pop()!;
        if (!canReachEnd.has(u)) {
            canReachEnd.add(u);
            reverseAdj[u].forEach(v => endStack.push(v));
        }
    }

    nodes.forEach(node => {
        if (!canReachEnd.has(node.id)) {
            errors.push({ type: 'error', message: `Path starting at '${node.data.label || node.id}' never reaches an End node.`, nodeId: node.id });
        }
    });

    // 6. Node-Specific Logical Checks
    nodes.forEach(node => {
        if (node.type === 'end') {
            if (!node.data.redirectUrl) {
                errors.push({ type: 'error', message: 'End node must have a Redirect URL.', nodeId: node.id });
            }
        }

        if (node.type === 'branch') {
            const condition = node.data.condition as any;
            if (!condition || !condition.children || condition.children.length === 0) {
                errors.push({ type: 'error', message: 'Branch node must have at least one valid condition rule.', nodeId: node.id });
            }

            // Causal Ordering: Referenced fields must be from nodes that appear BEFORE this branch
            const referencedFields = new Set<string>();
            const collectFields = (item: any) => {
                if (item.type === 'rule') {
                    if (item.field) referencedFields.add(item.field);
                    if (item.valueType === 'variable' && item.value) {
                        referencedFields.add(item.value);
                    }
                }
                else if (item.children) item.children.forEach(collectFields);
            };
            if (condition) collectFields(condition);

            const nodeIndex = topoOrder.indexOf(node.id);
            referencedFields.forEach(fieldId => {
                const fieldNodeIndex = topoOrder.indexOf(fieldId);
                // If fieldId is not in topoOrder or appears after/at current node, it's a violation
                // (Note: fieldId should ideally be an ancestor in all paths, but topo sort is a good baseline)
                if (fieldNodeIndex === -1 || fieldNodeIndex >= nodeIndex) {
                    errors.push({ 
                        type: 'error', 
                        message: `Branch depends on question '${fieldId}' which is not guaranteed to be answered before this branch.`, 
                        nodeId: node.id 
                    });
                }
            });

            // Branch degree check (True/False outputs)
            const outEdges = edges.filter(e => e.source === node.id);
            const hasTrue = outEdges.some(e => e.sourceHandle === 'true');
            const hasFalse = outEdges.some(e => e.sourceHandle === 'false');
            if (!hasTrue || !hasFalse) {
                errors.push({ type: 'error', message: 'Branch node must have both TRUE and FALSE connections.', nodeId: node.id });
            }
        } else if (node.type !== 'end') {
            // Non-branch nodes should have exactly one output (normally)
            const outEdges = edges.filter(e => e.source === node.id);
            if (outEdges.length > 1) {
                errors.push({ type: 'error', message: 'Standard question nodes can only have one outgoing connection.', nodeId: node.id });
            }
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};
