import { Node, Edge } from '@xyflow/react';

interface ValidationError {
    type: 'error' | 'warning';
    message: string;
    nodeId?: string;
}

const PII_HINT_REGEX =
    /\b(email|e-mail|phone|mobile|contact|name|first name|last name|full name|address|street|city|state|zipcode|zip|postal|ssn|social security|dob|birth|passport|aadhaar|pan|tax id)\b/i;

const looksLikePiiNode = (node: Node): boolean => {
    const data = (node.data || {}) as Record<string, unknown>;
    const label = String(data.label || "").trim();
    const description = String(data.description || "").trim();

    if (node.type === "emailInput" || node.type === "zipCodeInput") return true;
    if (PII_HINT_REGEX.test(label) || PII_HINT_REGEX.test(description)) return true;

    if (node.type === "multiInput" && Array.isArray(data.fields)) {
        return data.fields.some((field) => {
            const fieldRecord = field as Record<string, unknown>;
            const fieldLabel = String(fieldRecord?.label || "");
            return PII_HINT_REGEX.test(fieldLabel);
        });
    }

    return false;
};

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

            // Causal Ordering: Referenced fields must be strictly reachable ancestors
            // A topological sort index comparison (fieldNodeIndex >= nodeIndex) is inherently flawed for this check
            // because two parallel branches could be topologically ordered arbitrarily, yet one doesn't depend on the other.
            //
            // Instead, we verify that the referenced 'fieldId' can actually reach this 'branch' node.
            // If there is NO path from fieldId -> branch, then the branch cannot possibly know the answer.
            
            referencedFields.forEach(fieldId => {
                // Check if there is a path from fieldId to the current branch node
                const isReachable = () => {
                   const seen = new Set<string>();
                   const stack = [fieldId];
                   while(stack.length > 0) {
                       const u = stack.pop()!;
                       if(u === node.id) return true;
                       if(!seen.has(u)) {
                           seen.add(u);
                           // adj is defined in scope above, use it to traverse forward
                           if(adj[u]) {
                               adj[u].forEach(v => stack.push(v));
                           }
                       }
                   }
                   return false;
                };

                if (!isReachable()) {
                    const fieldLabel = nodes.find(n => n.id === fieldId)?.data?.label || fieldId;
                    errors.push({ 
                        type: 'error', 
                        message: `Branch depends on question '${fieldLabel}', but that question is not connected to this branch.`, 
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

    // 7. PII Recommendation Warnings (non-blocking)
    nodes.forEach((node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const isPiiEnabled = Boolean(data.isPii);
        if (!isPiiEnabled && looksLikePiiNode(node)) {
            const label = String(data.label || node.id);
            errors.push({
                type: "warning",
                message: `Node '${label}' looks like personal data. Consider enabling "Contains PII" or adding a survey-level PII override.`,
                nodeId: node.id,
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};
