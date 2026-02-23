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
                throw new Error(`Decision node ${currentNodeId} has no condition defined.`);
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

    private parseDateValue(input: any): Date | null {
        if (input === undefined || input === null || input === '') return null;
        if (input instanceof Date && !Number.isNaN(input.getTime())) {
            return new Date(input.getFullYear(), input.getMonth(), input.getDate());
        }
        if (typeof input === 'string') {
            const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const year = Number(match[1]);
                const month = Number(match[2]) - 1;
                const day = Number(match[3]);
                const date = new Date(year, month, day);
                if (
                    date.getFullYear() === year &&
                    date.getMonth() === month &&
                    date.getDate() === day
                ) {
                    return date;
                }
                return null;
            }
        }
        const parsed = new Date(input);
        if (Number.isNaN(parsed.getTime())) return null;
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    private shiftDate(base: Date, amount: number, unit: string): Date {
        const shifted = new Date(base.getTime());
        if (unit === 'months') {
            shifted.setMonth(shifted.getMonth() - amount);
            return shifted;
        }
        if (unit === 'years') {
            shifted.setFullYear(shifted.getFullYear() - amount);
            return shifted;
        }
        shifted.setDate(shifted.getDate() - amount);
        return shifted;
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

        const getNumericComparableValue = (input: any): number => {
            if (Array.isArray(input)) {
                const lastFilled = [...input].reverse().find(item => item !== undefined && item !== null && item !== '');
                return Number(lastFilled);
            }
            return Number(input);
        };

        const matchesRangeList = (candidate: any, rangeList: string): boolean => {
            const ranges = rangeList.split(',').map(s => s.trim()).filter(Boolean);
            return ranges.some(range => {
                if (range.includes('-')) {
                    const [start, end] = range.split('-').map(Number);
                    const num = getNumericComparableValue(candidate);
                    return !isNaN(num) && !isNaN(start) && !isNaN(end) && num >= start && num <= end;
                }
                return normStr(candidate) === normStr(range);
            });
        };

        const isDateInputField = fieldNode?.type === 'dateInput';
        const answerDate = isDateInputField ? this.parseDateValue(value) : null;
        const targetDate = isDateInputField ? this.parseDateValue(targetValue) : null;
        const compareDateParts = (part: 'day' | 'month' | 'year', operator: string, expected: number) => {
            if (!answerDate || Number.isNaN(expected)) return false;
            const actual = part === 'day' ? answerDate.getDate() : part === 'month' ? answerDate.getMonth() + 1 : answerDate.getFullYear();
            if (operator.endsWith('_lt')) return actual < expected;
            if (operator.endsWith('_lte')) return actual <= expected;
            if (operator.endsWith('_gt')) return actual > expected;
            if (operator.endsWith('_gte')) return actual >= expected;
            if (operator.endsWith('_eq')) return actual === expected;
            if (operator.endsWith('_neq')) return actual !== expected;
            return false;
        };
        const deriveAgeFromDob = (dob: Date, today: Date) => {
            let age = today.getFullYear() - dob.getFullYear();
            const hasHadBirthdayThisYear =
                today.getMonth() > dob.getMonth() ||
                (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
            if (!hasHadBirthdayThisYear) age -= 1;
            return age;
        };
        const areComparableValuesEqual = (left: any, right: any) => {
            if (Array.isArray(left) && Array.isArray(right)) {
                if (left.length !== right.length) return false;
                const lhs = left.map(normStr).sort();
                const rhs = right.map(normStr).sort();
                return lhs.every((v, idx) => v === rhs[idx]);
            }
            if (Array.isArray(left) || Array.isArray(right)) return false;
            return normStr(left) === normStr(right);
        };
        const getComparableLength = (input: any): number | null => {
            if (typeof input === 'string' || Array.isArray(input)) return input.length;
            return null;
        };

        switch (rule.operator) {
            case 'equals':
                if (isDateInputField && answerDate && targetDate) return answerDate.getTime() === targetDate.getTime();
                if (Array.isArray(value)) return value.some(v => normStr(v) === normStr(targetValue));
                return normStr(value) === normStr(targetValue);
            case 'not_equals':
                if (isDateInputField && answerDate && targetDate) return answerDate.getTime() !== targetDate.getTime();
                if (Array.isArray(value)) return !value.some(v => normStr(v) === normStr(targetValue));
                return normStr(value) !== normStr(targetValue);
            case 'contains':
                if (Array.isArray(value)) return value.some(v => normStr(v) === normStr(targetValue));
                return normStr(value).includes(normStr(targetValue));
            case 'not_contains':
                if (Array.isArray(value)) return !value.some(v => normStr(v) === normStr(targetValue));
                return !normStr(value).includes(normStr(targetValue));
            case 'gt':
                if (isDateInputField && answerDate && targetDate) return answerDate.getTime() > targetDate.getTime();
                return getNumericComparableValue(value) > Number(targetValue);
            case 'lt':
                if (isDateInputField && answerDate && targetDate) return answerDate.getTime() < targetDate.getTime();
                return getNumericComparableValue(value) < Number(targetValue);
            case 'date_before_relative':
            case 'date_before_or_equal_relative':
            case 'date_after_relative':
            case 'date_after_or_equal_relative': {
                if (!answerDate || typeof targetValue !== 'object' || targetValue === null) return false;
                const amount = Math.max(0, Number(targetValue.amount || 0));
                const unit = ['days', 'months', 'years'].includes(targetValue.unit) ? targetValue.unit : 'days';
                const today = new Date();
                const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const thresholdDate = this.shiftDate(todayDate, amount, unit);
                if (rule.operator === 'date_before_relative') return answerDate.getTime() < thresholdDate.getTime();
                if (rule.operator === 'date_before_or_equal_relative') return answerDate.getTime() <= thresholdDate.getTime();
                if (rule.operator === 'date_after_relative') return answerDate.getTime() > thresholdDate.getTime();
                return answerDate.getTime() >= thresholdDate.getTime();
            }
            case 'date_day_lt':
            case 'date_day_lte':
            case 'date_day_gt':
            case 'date_day_gte':
            case 'date_day_eq':
            case 'date_day_neq':
                return compareDateParts('day', rule.operator, Number(typeof targetValue === 'object' && targetValue !== null ? targetValue.value : targetValue));
            case 'date_month_lt':
            case 'date_month_lte':
            case 'date_month_gt':
            case 'date_month_gte':
            case 'date_month_eq':
            case 'date_month_neq':
                return compareDateParts('month', rule.operator, Number(typeof targetValue === 'object' && targetValue !== null ? targetValue.value : targetValue));
            case 'date_year_lt':
            case 'date_year_lte':
            case 'date_year_gt':
            case 'date_year_gte':
            case 'date_year_eq':
            case 'date_year_neq':
                return compareDateParts('year', rule.operator, Number(typeof targetValue === 'object' && targetValue !== null ? targetValue.value : targetValue));
            case 'age_matches_dob': {
                const compareField = (rule as any).compareField;
                if (!compareField || !(compareField in responses)) return false;
                let dobValue = responses[compareField];
                if (dobValue && typeof dobValue === 'object' && 'answer' in dobValue) {
                    dobValue = dobValue.answer;
                }
                const dobDate = this.parseDateValue(dobValue);
                const enteredAge = Number(value);
                if (!dobDate || Number.isNaN(enteredAge)) return false;
                const now = new Date();
                const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const derivedAge = deriveAgeFromDob(dobDate, todayDate);
                const toleranceYears = Math.max(
                    0,
                    Number(typeof targetValue === 'object' && targetValue !== null ? targetValue.toleranceYears ?? 1 : 1)
                );
                return Math.abs(enteredAge - derivedAge) <= toleranceYears;
            }
            case 'fields_match':
            case 'fields_not_match': {
                const compareField = (rule as any).compareField;
                if (!compareField || !(compareField in responses)) return false;
                let compareValue = responses[compareField];
                if (compareValue && typeof compareValue === 'object' && 'answer' in compareValue) {
                    compareValue = compareValue.answer;
                }
                const isEqual = areComparableValuesEqual(value, compareValue);
                return rule.operator === 'fields_match' ? isEqual : !isEqual;
            }
            case 'length_gte':
            case 'length_lte': {
                const actualLength = getComparableLength(value);
                const threshold = Number(typeof targetValue === 'object' && targetValue !== null ? targetValue.value : targetValue);
                if (actualLength === null || Number.isNaN(threshold)) return false;
                return rule.operator === 'length_gte' ? actualLength >= threshold : actualLength <= threshold;
            }
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
                    return matchesRangeList(value, targetValue);
                }
                return false;
            case 'not_in_range':
                if (typeof targetValue === 'string') {
                    return !matchesRangeList(value, targetValue);
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
