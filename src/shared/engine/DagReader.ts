import { LogicGroup, LogicRule } from "@/src/shared/types/survey";

export class DAGReader {
    private graph: Record<string, any>;

    constructor(graph: Record<string, any>) {
        this.graph = graph;
        this.validateGraphIdentity();
    }

    /**
     * Ensures all nodes in the graph have their own ID as a property and matches the key.
     */
    private validateGraphIdentity() {
        for (const [key, node] of Object.entries(this.graph)) {
            if (node.id !== key) {
                console.warn(`Node identity mismatch: key ${key} vs node.id ${node.id}`);
            }
        }
    }

    /**
     * Finds the starting node of the survey.
     */
    getStartNode() {
        const startNodes = Object.values(this.graph).filter(node => node.type === 'start');
        if (startNodes.length === 0) throw new Error("Start node missing in workflow.");
        if (startNodes.length > 1) throw new Error("Multiple start nodes found. Workflow invalid.");
        return startNodes[0];
    }

    /**
     * Returns the node object for a given ID.
     */
    getNode(id: string) {
        return this.graph[id] || null;
    }

    /**
     * Determines the next node in the flow based on current node and user responses.
     * Respects skip logic (node-level conditions).
     */
    getNextNode(currentNodeId: string, responses: Record<string, any>): any {
        const node = this.graph[currentNodeId];
        if (!node) return null;

        const next = node.next;
        if (!next) return null;

        let potentialNextId: string | null = null;

        if (next.kind === 'branch') {
            const condition = node.data?.condition as LogicGroup;
            if (!condition || !condition.children || condition.children.length === 0) {
                throw new Error(`Branch node ${currentNodeId} has no condition defined.`);
            }
            const isTrue = this.evaluateCondition(condition, responses);
            potentialNextId = isTrue ? next.trueId : next.falseId;
        } else {
            // Linear connection
            potentialNextId = next.nextId;
        }

        if (!potentialNextId) return null;

        // Check for Skip Logic on the destination node
        const potentialNextNode = this.graph[potentialNextId];
        if (potentialNextNode && potentialNextNode.data?.condition) {
            try {
                const isMet = this.evaluateCondition(potentialNextNode.data.condition, responses);
                if (!isMet) {
                    // Skip this node and move to ITS next node
                    return this.getNextNode(potentialNextId, responses);
                }
            } catch (err) {
                console.error(`Error evaluating skip logic for node ${potentialNextId}:`, err);
                // If evaluation fails (e.g. missing question), we might choose to show it or stay safe.
                // Usually, better to show it than stop the whole survey.
                return potentialNextNode;
            }
        }

        return potentialNextNode;
    }

    /**
     * Evaluates a complex logic group (AND/OR) against stored responses.
     */
    private evaluateCondition(group: LogicGroup | null | undefined, responses: Record<string, any>): boolean {
        if (!group || !group.children || group.children.length === 0) {
            throw new Error("Cannot evaluate an empty condition group.");
        }

        const results = group.children.map(child => {
            if (child.type === 'group') {
                return this.evaluateCondition(child as LogicGroup, responses);
            } else {
                return this.evaluateRule(child as LogicRule, responses);
            }
        });

        if (group.logicType === 'OR') {
            return results.some(r => r === true);
        } else {
            return results.every(r => r === true);
        }
    }

    /**
     * Evaluates a single logic rule against user responses.
     */
    private evaluateRule(rule: LogicRule, responses: Record<string, any>): boolean {
        if (!(rule.field in responses)) {
            return false;
        }

        let value = responses[rule.field];

        // --- FIX: Extract raw answer if it's a rich response object ---
        if (value && typeof value === 'object' && 'answer' in value) {
            value = value.answer;
        }

        // Handle subfield (e.g. for Matrix nodes)
        if (rule.subField && typeof value === 'object' && value !== null) {
            value = value[rule.subField];
        }

        let targetValue = rule.value;
        if (rule.valueType === 'variable') {
            if (!(rule.value in responses)) {
                return false;
            }
            targetValue = responses[rule.value];
            // Also extract .answer from variables if they are rich objects
            if (targetValue && typeof targetValue === 'object' && 'answer' in targetValue) {
                targetValue = targetValue.answer;
            }
        }

        // --- NEW: Resilience Logic for Label vs Value mismatch ---
        // If the referenced node is a choice/multi-choice, and the targetValue matches an option's LABEL,
        // we should also allow it to match the option's VALUE.
        const fieldNode = this.graph[rule.field];
        const possibleOptions = fieldNode?.data?.options || fieldNode?.data?.columns;
        
        const norm = (v: any) => String(v || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

        // Helper to resolve label -> value
        const resolveToValue = (val: string) => {
            const nVal = norm(val);
             // 1. Check standard options
             if (possibleOptions && Array.isArray(possibleOptions)) {
                const matchingOption = possibleOptions.find((opt: any) => norm(opt.label) === nVal);
                if (matchingOption) return matchingOption.value;
            }
            // 2. Check "Other" option
            if (fieldNode?.data?.allowOther && nVal !== 'other') {
                if (norm(fieldNode.data.otherLabel || 'Other') === nVal) {
                    return 'other';
                }
            }
            return val;
        };

        if (typeof value === 'string') {
            value = resolveToValue(value);
        }

        if (typeof targetValue === 'string') {
            targetValue = resolveToValue(targetValue);
        }
        // ---------------------------------------------------------

        const normStr = (v: any) => {
            if (v === undefined || v === null) return '';
            return String(v).toLowerCase().replace(/[’‘]/g, "'").trim();
        };

        switch (rule.operator) {
            case 'equals':
                if (Array.isArray(value)) return value.some(v => normStr(v) === normStr(targetValue));
                return normStr(value) === normStr(targetValue);
            case 'not_equals':
                if (Array.isArray(value)) return !value.some(v => normStr(v) === normStr(targetValue));
                return normStr(value) !== normStr(targetValue);
            case 'contains':
                if (Array.isArray(value)) return value.some(v => normStr(v) === normStr(targetValue));
                return normStr(value).includes(normStr(targetValue));
            case 'not_contains':
                if (Array.isArray(value)) return !value.some(v => normStr(v) === normStr(targetValue));
                return !normStr(value).includes(normStr(targetValue));
            case 'gt':
                return Number(value) > Number(targetValue);
            case 'lt':
                return Number(value) < Number(targetValue);
            case 'is_set':
                return value !== undefined && value !== null && value !== '';
            case 'is_empty':
                return value === undefined || value === null || value === '';
            case 'is_between':
                if (typeof targetValue === 'object' && targetValue !== null) {
                    const num = Number(value);
                    const min = Number(targetValue.min);
                    const max = Number(targetValue.max);
                    return !isNaN(num) && num >= min && num <= max;
                }
                return false;
            case 'in_range':
                if (typeof targetValue === 'string') {
                    const ranges = targetValue.split(',').map(s => s.trim());
                    return ranges.some(range => {
                        if (range.includes('-')) {
                            const [start, end] = range.split('-').map(Number);
                            const num = Number(value);
                            return !isNaN(num) && num >= start && num <= end;
                        }
                        return normStr(value) === normStr(range);
                    });
                }
                return false;
            default:
                return false;
        }
    }

    /**
     * Trace the path taken for a set of responses, with cycle protection.
     */
    getTakenPath(responses: Record<string, any>) {
        const path = [];
        const visited = new Set<string>();
        let current = this.getStartNode();

        // Check if start node itself has skip logic (unlikely but possible)
        if (current && current.data?.condition) {
            if (!this.evaluateCondition(current.data.condition, responses)) {
                // If start is skipped, we need to find the REAL start
                // But getNextNode depends on a current node. 
                // In our system, 'start' is always the entry point.
            }
        }

        while (current) {
            if (visited.has(current.id)) {
                throw new Error(`Cycle detected at node ${current.id} during runtime traversal.`);
            }
            visited.add(current.id);
            path.push(current);

            if (current.type === 'end') break;
            
            // This now uses the recursive/skip-logic-aware version
            const nextNode = this.getNextNode(current.id, responses);
            current = nextNode;
        }

        return path;
    }
}
