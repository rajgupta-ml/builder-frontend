import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconHierarchy } from '@tabler/icons-react';

const CascadingChoiceNode = (props: NodeProps<any>) => {
    const { label, description, required, steps } = props.data;

    // Default steps if undefined (should be handled by defaultProps but safe guard)
    const validSteps = Array.isArray(steps) ? steps : [];

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconHierarchy}
            color="bg-cyan-600"
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label || "Multi-Step Select"}
                        {required && <span className="text-destructive">*</span>}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="space-y-2 p-2 bg-muted/20 rounded-md border border-border">
                    {validSteps.length > 0 ? (
                        validSteps.map((step: any, index: number) => (
                            <div key={step.id || index} className={`space-y-1 ${index > 0 ? 'opacity-70' : ''}`}>
                                <label className="text-[10px] uppercase text-muted-foreground font-semibold">
                                    {step.title || `Step ${index + 1}`}
                                </label>
                                <div className="p-1.5 bg-background border border-input rounded text-xs flex justify-between items-center text-muted-foreground">
                                    <span className="truncate">Select Option...</span>
                                    <span className="text-[10px]">▼</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-muted-foreground italic text-center py-2">No steps configured</div>
                    )}
                </div>

                <div className="text-[9px] text-muted-foreground text-center">
                    {validSteps.length > 0 ? (
                        <span>Configured: {validSteps.length} Steps</span>
                    ) : (
                        <span className="text-yellow-600">Please add steps in properties</span>
                    )}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(CascadingChoiceNode);
