import React, { useMemo } from 'react';
import { Node } from '@xyflow/react';
import { getNodeDefinition, LogicGroup, LogicItem, LogicRule } from '@/components/nodes/definitions';
import { IconTrash, IconPlus, IconVariable, IconTypography, IconFolderPlus } from '@tabler/icons-react';
import { cn, generateUniqueId } from '@/lib/utils';

// Simple ID generator to avoid external dependencies for U
// Refactored to use lib/utils
// const generateId = () => ...

interface ConditionBuilderProps {
    value: LogicGroup;
    onChange: (val: LogicGroup) => void;
    nodes: Node[];
}

const OPERATORS = [
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
];

export const ConditionBuilder = ({ value, onChange, nodes }: ConditionBuilderProps) => {
    // Determine valid nodes for logic
    const validQuestions = useMemo(() => {
        return nodes.filter(n => {
            const def = getNodeDefinition(n.type || '');
            const isStructural = ['start', 'end', 'branch', 'image', 'video', 'audio'].includes(n.type || '');
            return def && !isStructural && n.id !== 'current';
        });
    }, [nodes]);

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
                isRoot={true}
                onRemove={() => { }} // Root cannot be removed
            />
        </div>
    );
};

// Recursive Group Component
const GroupItem = ({ group, onChange, validQuestions, isRoot, onRemove }: {
    group: LogicGroup,
    onChange: (g: LogicGroup) => void,
    validQuestions: Node[],
    isRoot?: boolean,
    onRemove: () => void
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
                        <div className="text-[10px] italic text-muted-foreground py-2 px-2">No conditions added. Always TRUE.</div>
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
                                    onRemove={() => removeChild(index)}
                                />
                            ) : (
                                <RuleItem
                                    rule={child}
                                    onUpdate={(r) => updateChild(index, r)}
                                    onRemove={() => removeChild(index)}
                                    validQuestions={validQuestions}
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

const RuleItem = ({ rule, onUpdate, onRemove, validQuestions }: {
    rule: LogicRule, onUpdate: (r: LogicRule) => void, onRemove: () => void, validQuestions: Node[]
}) => {
    // Logic for rendering inputs (same as before but adapted)
    const selectedQuestion = validQuestions.find(n => n.id === rule.field);

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
                value={rule.field}
                onChange={(e) => onUpdate({ ...rule, field: e.target.value, subField: '' })}
            >
                <option value="">Field...</option>
                {validQuestions.map(n => (
                    <option key={n.id} value={n.id}>{String(n.data.label || n.id)}</option>
                ))}
            </select>

            {/* Subfield if Matrix */}
            {selectedQuestion?.type === 'matrixChoice' && (
                <select
                    className="flex-1 min-w-[100px] text-[10px] p-1.5 rounded border border-input bg-card h-7"
                    value={rule.subField || ''}
                    onChange={(e) => onUpdate({ ...rule, subField: e.target.value })}
                >
                    <option value="">Row...</option>
                    {(selectedQuestion.data.rows as any[] || []).map((row: any, i: number) => (
                        <option key={i} value={row.value ?? row.label}>
                            {row.label}
                        </option>
                    ))}
                </select>
            )}

            {/* Operator */}
            <select
                className="w-[70px] shrink-0 text-[10px] p-1.5 rounded border border-input bg-card h-7"
                value={rule.operator}
                onChange={(e) => onUpdate({ ...rule, operator: e.target.value })}
            >
                {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                ))}
            </select>

            {/* Value Inputs based on Operator */}
            {!['is_set', 'is_empty'].includes(rule.operator) && (
                <div className={cn(
                    "flex gap-1 items-center min-w-0 transition-all",
                    ['in_range', 'is_between'].includes(rule.operator) ? "basis-full w-full mt-1 order-last" : "flex-1 min-w-[120px]"
                )}>

                    {/* IS BETWEEN: Dual Input */}
                    {rule.operator === 'is_between' ? (
                        <div className="flex gap-1 w-full">
                            <input
                                type="text"
                                className="w-1/2 text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                placeholder="Min"
                                value={typeof rule.value === 'object' ? rule.value.min : rule.value} // Fallback if switched from string
                                onChange={(e) => onUpdate({ ...rule, value: { ...(typeof rule.value === 'object' ? rule.value : {}), min: e.target.value } })}
                            />
                            <span className="text-[10px] self-center text-muted-foreground">-</span>
                            <input
                                type="text"
                                className="w-1/2 text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                placeholder="Max"
                                value={typeof rule.value === 'object' ? rule.value.max : ''}
                                onChange={(e) => onUpdate({ ...rule, value: { ...(typeof rule.value === 'object' ? rule.value : {}), max: e.target.value } })}
                            />
                        </div>
                    ) : rule.operator === 'in_range' ? (
                        /* IN RANGE: Textarea + File Upload */
                        <div className="flex gap-1 w-full items-start min-w-0">
                            <textarea
                                className="flex-1 text-[10px] p-1.5 rounded border border-input bg-card min-h-[28px] h-7 focus:h-20 transition-all resize-y"
                                placeholder="1-100, 200, 300..."
                                value={typeof rule.value === 'string' ? rule.value : ''}
                                onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                            />
                            <label className="shrink-0 cursor-pointer p-1.5 rounded border border-dashed border-input hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors h-7 w-7 flex items-center justify-center" title="Import from .txt">
                                <IconFolderPlus size={12} />
                                <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    ) : (
                        /* STANDARD: Single Input / Select */
                        <>
                            <div className="flex gap-1 items-center w-full">
                                <button
                                    className="shrink-0 p-1 rounded border border-input hover:bg-muted text-muted-foreground h-7 w-7 flex items-center justify-center"
                                    onClick={() => onUpdate({ ...rule, valueType: rule.valueType === 'static' ? 'variable' : 'static', value: '' })}
                                    title="Toggle Value Type"
                                >
                                    {rule.valueType === 'static' ? <IconTypography size={12} /> : <IconVariable size={12} />}
                                </button>

                                {rule.valueType === 'variable' ? (
                                    <select
                                        className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                        value={rule.value}
                                        onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                    >
                                        <option value="">Target...</option>
                                        {validQuestions.filter(n => n.id !== rule.field).map(n => (
                                            <option key={n.id} value={n.id}>{String(n.data.label || n.id)}</option>
                                        ))}
                                    </select>
                                ) : (
                                    questionOptions.length > 0 ? (
                                        <select
                                            className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                            value={rule.value}
                                            onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                        >
                                            <option value="">Select...</option>
                                            {questionOptions.map((opt: any, i: number) => (
                                                <option key={i} value={opt.value ?? opt.label}>
                                                    {opt.label || opt.value}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full text-[10px] p-1.5 rounded border border-input bg-card h-7"
                                            placeholder="Value..."
                                            value={rule.value}
                                            onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                                        />
                                    )
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
