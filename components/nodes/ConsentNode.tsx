import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconCheckbox } from '@tabler/icons-react';

const ConsentNode = (props: NodeProps<any>) => {
    const { label, description, required, checkboxLabel } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconCheckbox}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-bold text-foreground">
                        {label || "Terms"}
                        {required && <span className="text-destructive">*</span>}
                    </label>
                </div>

                <div className="p-2 bg-muted/30 rounded border border-border text-xs text-muted-foreground h-20 overflow-y-auto">
                    {description || "Terms text goes here..."}
                </div>

                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-primary bg-primary/20 flex items-center justify-center">
                        {/* Fake check */}
                    </div>
                    <span className="text-xs font-medium">{checkboxLabel || "I agree"}</span>
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(ConsentNode);
