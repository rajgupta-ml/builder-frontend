import { inferQuestionResponseMode, resolveStructuredItemKey } from '@surveystudio/node-registery/logic';
import React, { useMemo } from 'react';
import { Edge, Node } from '@xyflow/react';
import { getNodeDefinition, LogicGroup, LogicItem, LogicRule, POSTAL_CODE_COUNTRIES } from '@/components/nodes/definitions';
import { IconTrash, IconPlus, IconVariable, IconTypography, IconFolderPlus, IconX } from '@tabler/icons-react';
import { cn, generateUniqueId } from '@/lib/utils';

// Simple ID generator to avoid external dependencies for U
// Refactored to use lib/utils
// const generateId = () => ...

type FieldKeyMode = 'nodeId' | 'technicalId';
type OptionKeyMode = 'value' | 'exportId';
type BuilderMode = 'default' | 'validation';

interface ConditionBuilderProps {
    value: LogicGroup;
    onChange: (val: LogicGroup) => void;
    nodes: Node[];
    edges?: Edge[];
    currentNodeId?: string;
    /**
     * Controls which identifier is written into rule.field
     * - 'nodeId' (default): uses the ReactFlow node id
     * - 'technicalId': uses node.data.technicalId
     */
    fieldKeyMode?: FieldKeyMode;
    /**
     * Controls which identifier is written into rule.value for choice options
     * - 'value' (default): uses option.value
     * - 'exportId': uses the registry stable item key
     */
    optionKeyMode?: OptionKeyMode;
    builderMode?: BuilderMode;
}

const ALL_OPERATORS = [
    { label: 'Equals', value: 'equals' },
    { label: 'Does not equal', value: 'not_equals' },
    { label: 'Contains', value: 'contains' },
    { label: 'Does not contain', value: 'not_contains' },
    { label: 'Greater than', value: 'gt' },
    { label: 'Less than', value: 'lt' },
    { label: 'Is Set (Answered)', value: 'is_set' },
    { label: 'Is Empty', value: 'is_empty' },
    { label: 'Is Between', value: 'is_between' },
    { label: 'In Range List', value: 'in_range' },
    { label: 'Not In Range List', value: 'not_in_range' },
    { label: 'is valid postal code for', value: 'is_postal_code' },
    { label: 'Age matches DOB', value: 'age_matches_dob' },
    { label: 'Matches Field', value: 'fields_match' },
    { label: 'Does Not Match Field', value: 'fields_not_match' },
    { label: 'Length >=', value: 'length_gte' },
    { label: 'Length <=', value: 'length_lte' },
    { label: 'Date Before (Today - N, strict)', value: 'date_before_relative' },
    { label: 'Date Before/On (Today - N)', value: 'date_before_or_equal_relative' },
    { label: 'Date After (Today - N, strict)', value: 'date_after_relative' },
    { label: 'Date After/On (Today - N)', value: 'date_after_or_equal_relative' },
    { label: 'Day <', value: 'date_day_lt' },
    { label: 'Day <=', value: 'date_day_lte' },
    { label: 'Day >', value: 'date_day_gt' },
    { label: 'Day >=', value: 'date_day_gte' },
    { label: 'Day =', value: 'date_day_eq' },
    { label: 'Day !=', value: 'date_day_neq' },
    { label: 'Month <', value: 'date_month_lt' },
    { label: 'Month <=', value: 'date_month_lte' },
    { label: 'Month >', value: 'date_month_gt' },
    { label: 'Month >=', value: 'date_month_gte' },
    { label: 'Month =', value: 'date_month_eq' },
    { label: 'Month !=', value: 'date_month_neq' },
    { label: 'Year <', value: 'date_year_lt' },
    { label: 'Year <=', value: 'date_year_lte' },
    { label: 'Year >', value: 'date_year_gt' },
    { label: 'Year >=', value: 'date_year_gte' },
    { label: 'Year =', value: 'date_year_eq' },
    { label: 'Year !=', value: 'date_year_neq' },
];

// Map node types to their relevant operators for better UX
const OPERATORS_BY_NODE_TYPE: Record<string, string[]> = {
    // Choice-based: match by selection
    singleChoice: ['equals', 'not_equals', 'is_set', 'is_empty'],
    multipleChoice: ['contains', 'not_contains', 'equals', 'not_equals', 'is_set', 'is_empty'],
    dropdown: ['equals', 'not_equals', 'is_set', 'is_empty'],
    ranking: ['equals', 'not_equals', 'is_set', 'is_empty'],
    consent: ['equals', 'not_equals', 'is_set', 'is_empty'],
    emojiRating: ['equals', 'not_equals', 'is_set', 'is_empty'],
    cascadingChoice: ['equals', 'not_equals', 'contains', 'not_contains', 'gt', 'lt', 'is_set', 'is_empty'],
    matrixChoice: ['equals', 'not_equals', 'gt', 'lt', 'is_set', 'is_empty'],

    // Numeric: comparison operators
    numberInput: ['equals', 'not_equals', 'gt', 'lt', 'is_between', 'in_range', 'not_in_range', 'is_set', 'is_empty', 'age_matches_dob'],
    slider: ['equals', 'not_equals', 'gt', 'lt', 'is_between', 'in_range', 'not_in_range', 'is_set', 'is_empty'],
    rating: ['equals', 'not_equals', 'gt', 'lt', 'is_between', 'in_range', 'not_in_range', 'is_set', 'is_empty'],

    // Text-based: string operators
    textInput: ['equals', 'not_equals', 'contains', 'not_contains', 'is_set', 'is_empty', 'age_matches_dob'],
    emailInput: ['equals', 'not_equals', 'contains', 'not_contains', 'is_set', 'is_empty'],

    // Zip code: specialized for range lists
    zipCodeInput: ['equals', 'not_equals', 'contains', 'not_contains', 'in_range', 'not_in_range', 'is_postal_code', 'is_set', 'is_empty'],

    // Date: comparison
    dateInput: [
        'equals', 'not_equals', 'gt', 'lt', 'is_set', 'is_empty',
        'date_before_relative', 'date_before_or_equal_relative', 'date_after_relative', 'date_after_or_equal_relative',
        'date_day_lt', 'date_day_lte', 'date_day_gt', 'date_day_gte', 'date_day_eq', 'date_day_neq',
        'date_month_lt', 'date_month_lte', 'date_month_gt', 'date_month_gte', 'date_month_eq', 'date_month_neq',
        'date_year_lt', 'date_year_lte', 'date_year_gt', 'date_year_gte', 'date_year_eq', 'date_year_neq'
    ],
};

const getOperatorsForNodeType = (nodeType?: string): typeof ALL_OPERATORS => {
    if (!nodeType || !OPERATORS_BY_NODE_TYPE[nodeType]) return ALL_OPERATORS;
    const allowed = OPERATORS_BY_NODE_TYPE[nodeType];
    return ALL_OPERATORS.filter(op => allowed.includes(op.value));
};

const VALIDATION_OPERATOR_VALUES = new Set([
    'age_matches_dob',
    'fields_match',
    'fields_not_match',
    'length_gte',
    'length_lte',
    'gt',
    'lt',
    'is_between',
    'is_set',
    'is_empty',
]);

const getOperatorsForContext = (nodeType: string | undefined, builderMode: BuilderMode): typeof ALL_OPERATORS => {
    if (builderMode === 'validation') {
        return ALL_OPERATORS.filter(op => VALIDATION_OPERATOR_VALUES.has(op.value));
    }
    return getOperatorsForNodeType(nodeType);
};

const NUMERIC_NODE_TYPES = ['numberInput', 'slider', 'rating', 'emojiRating'];
const isNumericNodeType = (nodeType?: string) => nodeType ? NUMERIC_NODE_TYPES.includes(nodeType) : false;

const getQuestionKey = (node: Node, mode: FieldKeyMode): string => {
    if (mode === 'technicalId') {
        return String((node.data as any)?.technicalId || '');
    }
    return node.id;
};

const findQuestionByKey = (nodes: Node[], key: string, mode: FieldKeyMode): Node | undefined => {
    if (!key) return undefined;
    if (mode === 'technicalId') {
        return nodes.find(n => String((n.data as any)?.technicalId || '') === key);
    }
    return nodes.find(n => n.id === key);
};

const getOptionKey = (opt: any, mode: OptionKeyMode): string => {
    if (mode === 'exportId') {
        return resolveStructuredItemKey(opt);
    }
    return String(opt.value || '');
};

const getValuePlaceholder = (nodeType?: string, operator?: string): string => {
    switch (nodeType) {
        case 'zipCodeInput':
            if (operator === 'contains') return 'e.g. 110 (prefix match)';
            if (operator === 'not_contains') return 'e.g. 110 (exclude prefix)';
            return 'e.g. 110001';
        case 'numberInput':
        case 'slider':
            return 'e.g. 50';
        case 'rating':
            return 'e.g. 3';
        case 'emailInput':
            if (operator === 'contains') return 'e.g. @gmail.com';
            return 'e.g. user@example.com';
        case 'textInput':
            if (operator === 'contains') return 'Text to search for...';
            return 'Enter value...';
        case 'dateInput':
            return 'YYYY-MM-DD';
        default:
            return 'Value...';
    }
};

const DATE_RELATIVE_OPERATORS = new Set([
    'date_before_relative',
    'date_before_or_equal_relative',
    'date_after_relative',
    'date_after_or_equal_relative',
]);

const DATE_PART_OPERATORS = new Set([
    'date_day_lt', 'date_day_lte', 'date_day_gt', 'date_day_gte', 'date_day_eq', 'date_day_neq',
    'date_month_lt', 'date_month_lte', 'date_month_gt', 'date_month_gte', 'date_month_eq', 'date_month_neq',
    'date_year_lt', 'date_year_lte', 'date_year_gt', 'date_year_gte', 'date_year_eq', 'date_year_neq'
]);

const isDateRelativeOperator = (operator?: string) => !!operator && DATE_RELATIVE_OPERATORS.has(operator);
const isDatePartOperator = (operator?: string) => !!operator && DATE_PART_OPERATORS.has(operator);
const isAgeDobOperator = (operator?: string) => operator === 'age_matches_dob';
const isFieldCompareOperator = (operator?: string) => operator === 'fields_match' || operator === 'fields_not_match';
const isLengthOperator = (operator?: string) => operator === 'length_gte' || operator === 'length_lte';

const getDefaultRuleValueForOperator = (operator?: string) => {
    if (isDateRelativeOperator(operator)) {
        return { amount: 0, unit: 'days' };
    }
    if (isDatePartOperator(operator)) {
        const part = operator?.split('_')[1] || 'day';
        return { value: part === 'year' ? 2024 : 1 };
    }
    if (operator === 'is_between') {
        return { min: '', max: '' };
    }
    if (isAgeDobOperator(operator)) {
        return { toleranceYears: 1 };
    }
    if (isLengthOperator(operator)) {
        return { value: 1 };
    }
    return '';
};

const getDatePartMeta = (operator?: string) => {
    const part = operator?.split('_')[1];
    if (part === 'month') return { label: 'month', min: 1, max: 12, placeholder: '1-12' };
    if (part === 'year') return { label: 'year', min: 1000, max: 9999, placeholder: 'e.g. 2024' };
    return { label: 'day', min: 1, max: 31, placeholder: '1-31' };
};

const DATE_BASIC_OPERATOR_VALUES = new Set(['equals', 'not_equals', 'gt', 'lt', 'is_set', 'is_empty']);
const DATE_RELATIVE_OPERATOR_VALUES = new Set([
    'date_before_relative',
    'date_before_or_equal_relative',
    'date_after_relative',
    'date_after_or_equal_relative',
]);
const DATE_DAY_OPERATOR_VALUES = new Set(['date_day_lt', 'date_day_lte', 'date_day_gt', 'date_day_gte', 'date_day_eq', 'date_day_neq']);
const DATE_MONTH_OPERATOR_VALUES = new Set(['date_month_lt', 'date_month_lte', 'date_month_gt', 'date_month_gte', 'date_month_eq', 'date_month_neq']);
const DATE_YEAR_OPERATOR_VALUES = new Set(['date_year_lt', 'date_year_lte', 'date_year_gt', 'date_year_gte', 'date_year_eq', 'date_year_neq']);

const getInRangePlaceholder = (nodeType?: string): string => {
    switch (nodeType) {
        case 'zipCodeInput':
            return '10001-10099, 20001, 30001-30050';
        case 'numberInput':
        case 'slider':
            return '1-50, 75, 100-200';
        default:
            return '1-100, 200, 300...';
    }
};

export const ConditionBuilder = ({
    value,
    onChange,
    nodes,
    edges,
    currentNodeId,
    fieldKeyMode = 'nodeId',
    optionKeyMode = 'value',
    builderMode = 'default'
}: ConditionBuilderProps) => {
    const ancestorNodeIds = useMemo(() => {
        if (!currentNodeId || !edges) {
            return null;
        }

        const incomingByTarget = new Map<string, string[]>();
        edges.forEach((edge) => {
            const prev = incomingByTarget.get(edge.target) || [];
            prev.push(edge.source);
            incomingByTarget.set(edge.target, prev);
        });

        const visited = new Set<string>();
        const stack: string[] = [...(incomingByTarget.get(currentNodeId) || [])];

        while (stack.length > 0) {
            const nodeId = stack.pop()!;
            if (visited.has(nodeId) || nodeId === currentNodeId) continue;
            visited.add(nodeId);
            const parents = incomingByTarget.get(nodeId) || [];
            parents.forEach((parentId) => {
                if (!visited.has(parentId)) {
                    stack.push(parentId);
                }
            });
        }

        return visited;
    }, [currentNodeId, edges]);

    // Determine valid nodes for logic
    const validQuestions = useMemo(() => {
        return nodes.filter(n => {
            const def = getNodeDefinition(n.type || '');
            const isStructural = ['start', 'end', 'branch', 'validation', 'image', 'video', 'audio'].includes(n.type || '');
            const isAllowedByGraph = ancestorNodeIds ? ancestorNodeIds.has(n.id) : true;
            return def && !isStructural && n.id !== 'current' && isAllowedByGraph;
        });
    }, [ancestorNodeIds, nodes]);

    // Ensure initial value is valid Group
    const rootGroup: LogicGroup = (value && value.type === 'group') ? value : {
        id: 'root',
        type: 'group',
        logicType: 'AND',
        children: []
    };

    const handleUpdate = (newGroup: LogicGroup) => {
        onChange(newGroup);
    };

    return (
        <div className="p-1">
            <GroupItem
                group={rootGroup}
                onChange={handleUpdate}
                validQuestions={validQuestions}
                fieldKeyMode={fieldKeyMode}
                optionKeyMode={optionKeyMode}
                builderMode={builderMode}
                isRoot={true}
                onRemove={() => { }} // Root cannot be removed
            />
        </div>
    );
};

// Recursive Group Component
const GroupItem = ({ group, onChange, validQuestions, isRoot, onRemove, fieldKeyMode, optionKeyMode, builderMode }: {
    group: LogicGroup,
    onChange: (g: LogicGroup) => void,
    validQuestions: Node[],
    isRoot?: boolean,
    onRemove: () => void,
    fieldKeyMode: FieldKeyMode,
    optionKeyMode: OptionKeyMode,
    builderMode: BuilderMode
}) => {

    const updateSelf = (updates: Partial<LogicGroup>) => {
        onChange({ ...group, ...updates });
    };

    const addChildRule = () => {
        const newRule: LogicRule = {
            id: generateUniqueId('rule'),
            type: 'rule',
            field: '',
            operator: 'equals',
            value: '',
            valueType: 'static'
        };
        onChange({ ...group, children: [...group.children, newRule] });
    };

    const addChildGroup = () => {
        const newGroup: LogicGroup = {
            id: generateUniqueId('group'),
            type: 'group',
            logicType: 'AND',
            children: []
        };
        onChange({ ...group, children: [...group.children, newGroup] });
    };

    const updateChild = (index: number, newChild: LogicItem) => {
        const newChildren = [...group.children];
        newChildren[index] = newChild;
        onChange({ ...group, children: newChildren });
    };

    const removeChild = (index: number) => {
        const newChildren = group.children.filter((_, i) => i !== index);
        onChange({ ...group, children: newChildren });
    };

    return (
        <div className={cn(
            "space-y-2 rounded-md transition-all",
            !isRoot && "p-3 border border-border/50 bg-muted/20 ml-4 relative before:absolute before:left-[-17px] before:top-[16px] before:w-[16px] before:h-px before:bg-border/50"
        )}>
            {/* Header: Logic Type & Actions */}
            <div className="flex items-center gap-2">
                {!isRoot && (
                    <button
                        onClick={onRemove}
                        className="mr-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove Group"
                    >
                        <IconTrash size={14} />
                    </button>
                )}

                <span className="text-[10px] uppercase font-bold text-muted-foreground">Match</span>
                <div className="flex bg-background border border-input rounded-md overflow-hidden h-6 shadow-sm">
                    <button
                        onClick={() => updateSelf({ logicType: 'AND' })}
                        className={cn("px-2 text-[10px] font-medium transition-colors", group.logicType === 'AND' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
                    >
                        ALL
                    </button>
                    <div className="w-px bg-border" />
                    <button
                        onClick={() => updateSelf({ logicType: 'OR' })}
                        className={cn("px-2 text-[10px] font-medium transition-colors", group.logicType === 'OR' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
                    >
                        ANY
                    </button>
                </div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">of the following:</span>
            </div >

            {/* Children List */}
            < div className={cn("space-y-2", isRoot ? "mt-2" : "mt-2 pl-1 border-l-2 border-border/30")} >
                {
                    group.children.length === 0 && (
                        <div className="text-[10px] italic text-muted-foreground py-2 px-2">No logic added. This question will always be shown.</div>
                    )
                }

                {
                    group.children.map((child, index) => (
                        <div key={child.id} className="relative">
                            {child.type === 'group' ? (
                                <GroupItem
                                    group={child}
                                    onChange={(g) => updateChild(index, g)}
                                    validQuestions={validQuestions}
                                    fieldKeyMode={fieldKeyMode}
                                    optionKeyMode={optionKeyMode}
                                    builderMode={builderMode}
                                    onRemove={() => removeChild(index)}
                                />
                            ) : (
                                <RuleItem
                                    rule={child}
                                    onUpdate={(r) => updateChild(index, r)}
                                    onRemove={() => removeChild(index)}
                                    validQuestions={validQuestions}
                                    fieldKeyMode={fieldKeyMode}
                                    optionKeyMode={optionKeyMode}
                                    builderMode={builderMode}
                                />
                            )}
                        </div>
                    ))
                }
            </div >

            {/* Footer Actions */}
            < div className="flex gap-2 mt-2 pt-1" >
                <button
                    onClick={addChildRule}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline hover:bg-primary/5 px-2 py-1 rounded"
                >
                    <IconPlus size={12} /> Add Rule
                </button>
                <button
                    onClick={addChildGroup}
                    className="flex items-center gap-1 text-xs text-purple-600 font-medium hover:underline hover:bg-purple-500/5 px-2 py-1 rounded"
                >
                    <IconFolderPlus size={12} /> Add Group
                </button>
            </div >
        </div >
    );
};

const RuleItem = ({ rule, onUpdate, onRemove, validQuestions, fieldKeyMode, optionKeyMode, builderMode }: {
    rule: LogicRule;
    onUpdate: (r: LogicRule) => void;
    onRemove: () => void;
    validQuestions: Node[];
    fieldKeyMode: FieldKeyMode;
    optionKeyMode: OptionKeyMode;
    builderMode: BuilderMode;
}) => {
    // Local state for the tag input in 'in_range' mode
    const [tagInput, setTagInput] = React.useState('');

    // Logic for rendering inputs (same as before but adapted)
    const selectedQuestion = useMemo(
        () => findQuestionByKey(validQuestions, rule.field, fieldKeyMode),
        [validQuestions, rule.field, fieldKeyMode]
    );
    const selectedQuestionData = (selectedQuestion?.data || {}) as any;
    const availableOperators = getOperatorsForContext(selectedQuestion?.type as string, builderMode);
    const isScaleMultiMode =
        (selectedQuestion?.type === 'rating' || selectedQuestion?.type === 'slider')
            ? inferQuestionResponseMode(selectedQuestionData) === 'multi'
            : false;
    const shouldShowSubField =
        selectedQuestion?.type === 'matrixChoice' ||
        selectedQuestion?.type === 'multiInput' ||
        isScaleMultiMode;
    const selectedType = selectedQuestion?.type;
    const isCustomDateOperator = isDateRelativeOperator(rule.operator) || isDatePartOperator(rule.operator);
    const isAgeDobConsistencyOperator = isAgeDobOperator(rule.operator);
    const isGenericFieldCompareOperator = isFieldCompareOperator(rule.operator);
    const dobComparableQuestions = validQuestions.filter((n) => n.type === 'dateInput' && getQuestionKey(n, fieldKeyMode) !== rule.field);
    const comparableQuestions = validQuestions.filter((n) => getQuestionKey(n, fieldKeyMode) !== rule.field);

    let questionOptions: any[] = [];
    if (selectedQuestion) {
        if (selectedQuestion.type === 'matrixChoice') {
            questionOptions = (selectedQuestion.data.columns as any[]) || [];
        } else if (selectedQuestion.type === 'cascadingChoice') {
            const steps = (selectedQuestion.data.steps as any[]) || [];
            questionOptions = steps.flatMap((s: any) => s.options || []);
        } else {
            questionOptions = [...((selectedQuestion.data.options as any[]) || [])];
            if (selectedQuestion.data.allowOther) {
                questionOptions.push({
                    label: selectedQuestion.data.otherLabel || 'Other',
                    value: 'other' // We will use 'other' as the value for the "Other" selection
                });
            }
            if (selectedQuestion.data.allowNone) {
                questionOptions.push({
                    label: selectedQuestion.data.noneLabel || 'None of these',
                    value: 'none'
                });
            }
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
                // Split by newline or comma, trim whitespace, and filter empty
                const tokens = text.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
                if (tokens.length > 0) {
                    const unique = Array.from(new Set(tokens)).join(', ');
                    onUpdate({ ...rule, value: unique });
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-background border border-input rounded-md shadow-sm group hover:border-primary/50 transition-colors">
            {/* Field Select */}
            <select
                className="flex-1 min-w-[100px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                disabled={validQuestions.length === 0}
                value={rule.field}
                onChange={(e) => {
                    const newFieldId = e.target.value;
                    const newQuestion = findQuestionByKey(validQuestions, newFieldId, fieldKeyMode);
                    const allowedOps = getOperatorsForContext(newQuestion?.type as string, builderMode);
                    const currentOpValid = allowedOps.some(op => op.value === rule.operator);
                    onUpdate({
                        ...rule,
                        field: newFieldId,
                        subField: '',
                        compareField: '',
                        operator: currentOpValid ? rule.operator : allowedOps[0]?.value || 'equals',
                        value: currentOpValid ? rule.value : getDefaultRuleValueForOperator(allowedOps[0]?.value || 'equals'),
                        valueType: 'static'
                    });
                }}
            >
                <option value="">Field...</option>
                {validQuestions.map(n => {
                    const questionKey = getQuestionKey(n, fieldKeyMode);
                    if (!questionKey) return null;
                    return (
                    <option
                        key={questionKey}
                        value={questionKey}
                    >
                        {String((n.data as any)?.label || n.id)}
                    </option>
                    );
                })}
            </select>
            {validQuestions.length === 0 && (
                <span className="basis-full text-[10px] text-muted-foreground italic">
                    No previous questions available for logic at this step.
                </span>
            )}

            {/* Subfield if Matrix, Slider, Rating, or MultiInput */}
            {shouldShowSubField && (
                <select
                    className="flex-1 min-w-[100px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                    value={rule.subField || ''}
                    onChange={(e) => onUpdate({ ...rule, subField: e.target.value })}
                >
                    <option value="">
                        {selectedType === 'matrixChoice' ? 'Row...' :
                            selectedType === 'multiInput' ? 'Field...' : 'Item...'}
                    </option>
                    {(selectedType === 'multiInput'
                        ? (selectedQuestionData.fields as any[] || [])
                        : (selectedQuestionData.items as any[] || selectedQuestionData.rows as any[] || [])
                    ).map((sub: any, i: number) => {
                        const optionKey = getOptionKey(sub, optionKeyMode);
                        if (!optionKey) return null;
                        return (
                        <option key={optionKey} value={optionKey}>
                            {sub.label || sub.text || sub.id}
                        </option>
                        );
                    })}
                </select>
            )}

            {/* Operator — filtered by selected question type */}
            <select
                className={cn(
                    "shrink-0 text-[10px] p-1.5 rounded border border-input bg-card h-7",
                    selectedType === 'dateInput' && builderMode !== 'validation'
                        ? "w-[190px]"
                        : (isAgeDobConsistencyOperator || isGenericFieldCompareOperator) ? "w-[160px]" : "w-[90px]"
                )}
                value={rule.operator}
                onChange={(e) => {
                    const nextOperator = e.target.value;
                    const nextValue = getDefaultRuleValueForOperator(nextOperator);
                    onUpdate({
                        ...rule,
                        operator: nextOperator,
                        value: nextValue,
                        compareField: (isAgeDobOperator(nextOperator) || isFieldCompareOperator(nextOperator)) ? (rule.compareField || '') : '',
                        valueType: isDateRelativeOperator(nextOperator) || isDatePartOperator(nextOperator) || isAgeDobOperator(nextOperator) || isFieldCompareOperator(nextOperator) || isLengthOperator(nextOperator)
                            ? 'static'
                            : rule.valueType
                    });
                }}
            >
                {selectedType === 'dateInput' && builderMode !== 'validation' ? (
                    <>
                        <optgroup label="Basic">
                            {availableOperators
                                .filter(op => DATE_BASIC_OPERATOR_VALUES.has(op.value))
                                .map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                        </optgroup>
                        <optgroup label="Relative (Today - N)">
                            {availableOperators
                                .filter(op => DATE_RELATIVE_OPERATOR_VALUES.has(op.value))
                                .map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                        </optgroup>
                        <optgroup label="Day">
                            {availableOperators
                                .filter(op => DATE_DAY_OPERATOR_VALUES.has(op.value))
                                .map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                        </optgroup>
                        <optgroup label="Month">
                            {availableOperators
                                .filter(op => DATE_MONTH_OPERATOR_VALUES.has(op.value))
                                .map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                        </optgroup>
                        <optgroup label="Year">
                            {availableOperators
                                .filter(op => DATE_YEAR_OPERATOR_VALUES.has(op.value))
                                .map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                        </optgroup>
                    </>
                ) : (
                    availableOperators.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                    ))
                )}
            </select>

            {/* Value Inputs based on Operator */}
            {!['is_set', 'is_empty'].includes(rule.operator) && (
                <div className={cn(
                    "flex gap-1 items-center min-w-0 transition-all",
                    ['in_range', 'not_in_range', 'is_between'].includes(rule.operator) ? "basis-full w-full mt-1 order-last" : "flex-1 min-w-[120px]"
                )}>

                    {/* AGE vs DOB CONSISTENCY */}
                    {isAgeDobConsistencyOperator ? (
                        <div className="flex gap-1 w-full items-center">
                            <select
                                className="flex-1 min-w-[120px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                value={rule.compareField || ''}
                                onChange={(e) => onUpdate({ ...rule, compareField: e.target.value })}
                            >
                                <option value="">DOB field...</option>
                                {dobComparableQuestions.map((n) => (
                                    <option key={getQuestionKey(n, fieldKeyMode)} value={getQuestionKey(n, fieldKeyMode)}>
                                        {String((n.data as any)?.label || n.id)}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">tol</span>
                            <input
                                type="number"
                                min={0}
                                max={2}
                                className="w-[68px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                value={typeof rule.value === 'object' && rule.value !== null ? (rule.value.toleranceYears ?? 1) : 1}
                                onChange={(e) => {
                                    const toleranceYears = Math.max(0, Math.min(2, Number(e.target.value || 0)));
                                    onUpdate({ ...rule, value: { toleranceYears } });
                                }}
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">yr</span>
                        </div>
                    ) : isGenericFieldCompareOperator ? (
                        <div className="flex gap-1 w-full items-center">
                            <select
                                className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                value={rule.compareField || ''}
                                onChange={(e) => onUpdate({ ...rule, compareField: e.target.value })}
                            >
                                <option value="">Compare field...</option>
                                {comparableQuestions.map((n) => (
                                    <option key={getQuestionKey(n, fieldKeyMode)} value={getQuestionKey(n, fieldKeyMode)}>
                                        {String((n.data as any)?.label || n.id)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : isLengthOperator(rule.operator) ? (
                        <div className="flex gap-1 w-full items-center">
                            <input
                                type="number"
                                min={0}
                                className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                placeholder="Length"
                                value={typeof rule.value === 'object' && rule.value !== null ? (rule.value.value ?? '') : rule.value}
                                onChange={(e) => onUpdate({ ...rule, value: { value: Math.max(0, Number(e.target.value || 0)) } })}
                            />
                        </div>
                    ) : isDateRelativeOperator(rule.operator) ? (
                        /* DATE RELATIVE */
                        <div className="flex gap-1 w-full items-center">
                            <input
                                type="number"
                                min={0}
                                className="w-[90px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                placeholder="N"
                                value={typeof rule.value === 'object' && rule.value !== null ? (rule.value.amount ?? 0) : 0}
                                onChange={(e) => {
                                    const nextAmount = Math.max(0, Number(e.target.value || 0));
                                    const current = (typeof rule.value === 'object' && rule.value !== null) ? rule.value : {};
                                    onUpdate({ ...rule, value: { ...current, amount: nextAmount } });
                                }}
                            />
                            <select
                                className="w-[120px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                value={typeof rule.value === 'object' && rule.value !== null ? (rule.value.unit || 'days') : 'days'}
                                onChange={(e) => {
                                    const current = (typeof rule.value === 'object' && rule.value !== null) ? rule.value : {};
                                    onUpdate({ ...rule, value: { ...current, unit: e.target.value } });
                                }}
                            >
                                <option value="days">Days</option>
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                            </select>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                from today
                            </span>
                        </div>
                    ) : isDatePartOperator(rule.operator) ? (
                        /* DATE PART */
                        <div className="flex gap-1 w-full items-center">
                            {(() => {
                                const partMeta = getDatePartMeta(rule.operator);
                                return (
                                    <>
                                        <span className="text-[10px] text-muted-foreground w-[55px] capitalize">
                                            {partMeta.label}
                                        </span>
                                        <input
                                            type="number"
                                            min={partMeta.min}
                                            max={partMeta.max}
                                            className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                            placeholder={partMeta.placeholder}
                                            value={typeof rule.value === 'object' && rule.value !== null ? (rule.value.value ?? '') : rule.value}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const parsed = raw === '' ? '' : Number(raw);
                                                const clamped =
                                                    parsed === '' ? '' : Math.min(partMeta.max, Math.max(partMeta.min, parsed));
                                                onUpdate({ ...rule, value: { value: clamped } });
                                            }}
                                        />
                                    </>
                                );
                            })()}
                        </div>
                    ) : rule.operator === 'is_between' ? (
                        /* IS BETWEEN: Dual Input */
                        <div className="flex gap-1 w-full">
                            <input
                                type={isNumericNodeType(selectedQuestion?.type) ? 'number' : 'text'}
                                className="w-1/2 text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                placeholder="Min"
                                value={typeof rule.value === 'object' ? rule.value.min : rule.value}
                                onChange={(e) => onUpdate({ ...rule, value: { ...(typeof rule.value === 'object' ? rule.value : {}), min: e.target.value } })}
                            />
                            <span className="text-[10px] self-center text-muted-foreground">–</span>
                            <input
                                type={isNumericNodeType(selectedQuestion?.type) ? 'number' : 'text'}
                                className="w-1/2 text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                placeholder="Max"
                                value={typeof rule.value === 'object' ? rule.value.max : ''}
                                onChange={(e) => onUpdate({ ...rule, value: { ...(typeof rule.value === 'object' ? rule.value : {}), max: e.target.value } })}
                            />
                        </div>
                    ) : ['in_range', 'not_in_range'].includes(rule.operator) ? (
                        /* IN RANGE: Multi-value Tag Input + File Upload */
                        <div className="flex flex-col gap-1 w-full">
                            <div
                                className="flex flex-wrap gap-1 p-1.5 rounded border border-input bg-card min-h-[32px] focus-within:ring-1 focus-within:ring-ring transition-all items-center"
                                onClick={() => document.getElementById(`tag-input-${rule.id}`)?.focus()}
                            >
                                {/* Existing Tags */}
                                {rule.value && typeof rule.value === 'string' && rule.value.split(',').map((tag: string, i: number) => {
                                    const t = tag.trim();
                                    if (!t) return null;
                                    return (
                                        <div key={i} className="flex items-center gap-1 bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full border border-primary/20">
                                            <span>{t}</span>
                                            <button
                                                className="hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newTags = rule.value.split(',').map((s: string) => s.trim()).filter((_: any, idx: number) => idx !== i);
                                                    onUpdate({ ...rule, value: newTags.join(',') });
                                                }}
                                            >
                                                <IconX size={10} />
                                            </button>
                                        </div>
                                    );
                                })}

                                {/* Input Field */}
                                <input
                                    id={`tag-input-${rule.id}`}
                                    type="text"
                                    className="flex-1 min-w-[60px] text-[10px] bg-transparent outline-none h-5"
                                    placeholder={(!rule.value || rule.value.length === 0) ? getInRangePlaceholder(selectedQuestion?.type).split(',')[0] + '...' : ''}
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (['Enter', ','].includes(e.key)) {
                                            e.preventDefault();
                                            const val = tagInput.trim().replace(/,$/, '');
                                            if (val) {
                                                const current = rule.value ? rule.value.split(',') : [];
                                                const newVal = [...current, val].filter(Boolean).join(',');
                                                onUpdate({ ...rule, value: newVal });
                                                setTagInput('');
                                            }
                                        } else if (e.key === 'Backspace' && !tagInput) {
                                            // Make removing the last tag easier
                                            const current = rule.value ? rule.value.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                            if (current.length > 0) {
                                                current.pop();
                                                onUpdate({ ...rule, value: current.join(',') });
                                            }
                                        }
                                    }}
                                    onBlur={() => {
                                        if (tagInput.trim()) {
                                            const val = tagInput.trim();
                                            const current = rule.value ? rule.value.split(',') : [];
                                            const newVal = [...current, val].filter(Boolean).join(',');
                                            onUpdate({ ...rule, value: newVal });
                                            setTagInput('');
                                        }
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const paste = e.clipboardData.getData('text');
                                        if (paste) {
                                            const newTags = paste.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
                                            if (newTags.length > 0) {
                                                const current = rule.value ? rule.value.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                                const merged = Array.from(new Set([...current, ...newTags])).join(',');
                                                onUpdate({ ...rule, value: merged });
                                                setTagInput('');
                                            }
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex items-center gap-2 justify-between px-1">
                                <span className="text-[9px] text-muted-foreground italic">Type and press Enter</span>
                                <label className="cursor-pointer text-[9px] flex items-center gap-1 text-primary hover:underline transition-colors" title="Import from .txt or .csv">
                                    <IconFolderPlus size={12} />
                                    <span>Import List</span>
                                    <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                        </div>
                    ) : (
                        /* STANDARD: Select from options OR text/number input */
                        <>
                            <div className="flex gap-1 items-center w-full">
                                {!isCustomDateOperator && !isAgeDobConsistencyOperator && (
                                    <button
                                        className="shrink-0 p-1 rounded border border-input hover:bg-muted text-muted-foreground h-7 w-7 flex items-center justify-center"
                                        onClick={() => onUpdate({ ...rule, valueType: rule.valueType === 'static' ? 'variable' : 'static', value: '' })}
                                        title={rule.valueType === 'static' ? 'Switch to compare with another question' : 'Switch to static value'}
                                    >
                                        {rule.valueType === 'static' ? <IconTypography size={12} /> : <IconVariable size={12} />}
                                    </button>
                                )}

                                {rule.valueType === 'variable' && !isAgeDobConsistencyOperator ? (
                                    <select
                                        className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                        value={rule.value}
                                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                    >
                                        <option value="">Compare with...</option>
                                        {validQuestions
                                            .filter(n => getQuestionKey(n, fieldKeyMode) !== rule.field)
                                            .map(n => {
                                                const questionKey = getQuestionKey(n, fieldKeyMode);
                                                if (!questionKey) return null;
                                                return (
                                                <option
                                                    key={questionKey}
                                                    value={questionKey}
                                                >
                                                    {String((n.data as any)?.label || n.id)}
                                                </option>
                                                );
                                            })}
                                    </select>
                                ) : rule.operator === 'is_postal_code' ? (
                                    <select
                                        className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                        value={rule.value}
                                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                    >
                                        <option value="">Select country...</option>
                                        {POSTAL_CODE_COUNTRIES.map((country: any) => (
                                            <option key={country.value} value={country.value}>
                                                {country.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : questionOptions.length > 0 ? (
                                    <select
                                        className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                        value={rule.value}
                                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                    >
                                        <option value="">Select option...</option>
                                        {questionOptions.map((opt: any) => {
                                            const optionKey = getOptionKey(opt, optionKeyMode);
                                            if (!optionKey) return null;
                                            return (
                                            <option
                                                key={optionKey}
                                                value={optionKey}
                                            >
                                                {opt.label || opt.value}
                                            </option>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    <input
                                        type={isNumericNodeType(selectedQuestion?.type) ? 'number' : 'text'}
                                        className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                        placeholder={getValuePlaceholder(selectedQuestion?.type, rule.operator)}
                                        value={rule.value}
                                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Remove Rule */}
            <button
                onClick={onRemove}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors ml-auto"
            >
                <IconTrash size={14} />
            </button>
        </div>
    );
};
