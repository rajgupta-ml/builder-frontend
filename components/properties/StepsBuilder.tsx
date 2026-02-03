import React, { useState } from 'react';
import { IconTrash, IconPlus, IconGripVertical, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { cn } from '@/lib/utils'; // Assuming you have a utility for classNames

interface StepOption {
    label: string;
    value: string;
}

interface Step {
    id: string;
    title: string;
    options: StepOption[];
    allowOther: boolean;
    otherLabel: string;
}

interface StepsBuilderProps {
    value: Step[];
    onChange: (steps: Step[]) => void;
}

export const StepsBuilder = ({ value, onChange }: StepsBuilderProps) => {
    // Ensure value is an array
    const steps = Array.isArray(value) ? value : [];

    // Start with at least one step if empty? No, let user add.

    const addStep = () => {
        const newStep: Step = {
            id: `step_${Date.now()}`,
            title: `Step ${steps.length + 1}`,
            options: [{ label: 'Option 1', value: 'opt1' }],
            allowOther: false,
            otherLabel: 'Other (Please specify)'
        };
        onChange([...steps, newStep]);
    };

    const updateStep = (index: number, updates: Partial<Step>) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], ...updates };
        onChange(newSteps);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        onChange(newSteps);
    };

    return (
        <div className="space-y-4">
            {steps.map((step, index) => (
                <StepItem
                    key={step.id}
                    step={step}
                    index={index}
                    onUpdate={(u) => updateStep(index, u)}
                    onRemove={() => removeStep(index)}
                />
            ))}

            <button
                onClick={addStep}
                className="w-full py-2 border-2 border-dashed border-border rounded-md text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
                <IconPlus size={14} /> Add Step
            </button>
        </div>
    );
};

const StepItem = ({ step, index, onUpdate, onRemove }: { step: Step, index: number, onUpdate: (u: Partial<Step>) => void, onRemove: () => void }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const addOption = () => {
        const newOption = { label: `Option ${step.options.length + 1}`, value: `opt_${Date.now()}` };
        onUpdate({ options: [...step.options, newOption] });
    };

    const updateOption = (optIndex: number, val: string) => {
        const newOptions = [...step.options];
        newOptions[optIndex] = { ...newOptions[optIndex], label: val };
        onUpdate({ options: newOptions });
    };

    const removeOption = (optIndex: number) => {
        const newOptions = step.options.filter((_, i) => i !== optIndex);
        onUpdate({ options: newOptions });
    };

    return (
        <div className="border border-border rounded-md bg-background overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 p-2 bg-muted/20 border-b border-border">
                <div className="cursor-grab text-muted-foreground"><IconGripVertical size={14} /></div>
                <div className="flex-1 font-semibold text-xs text-foreground">Step {index + 1}</div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-muted-foreground hover:text-foreground">
                    {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                </button>
                <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
                    <IconTrash size={14} />
                </button>
            </div>

            {/* Body */}
            {isExpanded && (
                <div className="p-3 space-y-3">
                    {/* Question Title */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Question / Title</label>
                        <input
                            type="text"
                            className="w-full text-xs p-1.5 rounded border border-input bg-background"
                            value={step.title}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                            placeholder="e.g. Select Category"
                        />
                    </div>

                    {/* Options List */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Options</label>
                        {step.options.map((opt, i) => (
                            <div key={i} className="flex gap-1">
                                <input
                                    type="text"
                                    className="flex-1 text-xs p-1.5 rounded border border-input bg-background"
                                    value={opt.label}
                                    onChange={(e) => updateOption(i, e.target.value)}
                                    placeholder={`Option ${i + 1}`}
                                />
                                <button onClick={() => removeOption(i)} className="p-1.5 text-muted-foreground hover:text-destructive">
                                    <IconX size={14} />
                                </button>
                            </div>
                        ))}
                        <button onClick={addOption} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            <IconPlus size={10} /> Add Option
                        </button>
                    </div>

                    {/* Other Toggle */}
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                        <label className="text-xs font-medium">Allow "Other"?</label>
                        <button
                            onClick={() => onUpdate({ allowOther: !step.allowOther })}
                            className={cn(
                                "relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-hidden",
                                step.allowOther ? "bg-primary" : "bg-input"
                            )}
                        >
                            <span className={cn("inline-block h-2 w-2 transform rounded-full bg-white transition-transform", step.allowOther ? "translate-x-4" : "translate-x-1")} />
                        </button>
                    </div>

                    {step.allowOther && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">"Other" Placeholder</label>
                            <input
                                type="text"
                                className="w-full text-xs p-1.5 rounded border border-input bg-background"
                                value={step.otherLabel}
                                onChange={(e) => onUpdate({ otherLabel: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Simple Icon X wrapper since it was missing in imports for subcomponent
const IconX = ({ size }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
