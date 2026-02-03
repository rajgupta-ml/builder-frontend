import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconForms } from '@tabler/icons-react';

const MultiInputNode = (props: NodeProps<any>) => {
    const { label, description, required, fields } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconForms}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label || "Contact Info"}
                        {required && <span className="text-destructive">*</span>}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="grid gap-3">
                    {(fields as any[] || []).map((field: any, i: number) => (
                        <div key={i} className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase">{field.label || `Field ${i + 1}`}</label>
                            <div className="w-full border-b border-border py-1 text-xs text-muted-foreground/50 italic">
                                {field.value || "text"} input...
                            </div>
                        </div>
                    ))}
                    {(!fields || fields.length === 0) && (
                        <div className="text-xs text-muted-foreground italic">No fields defined</div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(MultiInputNode);
