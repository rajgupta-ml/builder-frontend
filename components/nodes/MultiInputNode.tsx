import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconForms } from '@tabler/icons-react';
import { MultiInputNode as MultiInputPrimitive } from '@surveystudio/node-registery/ui';

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
            <MultiInputPrimitive.Root className="space-y-4">
                <MultiInputPrimitive.Header className="space-y-1">
                    <MultiInputPrimitive.Label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label || "Contact Info"}
                        {required && <MultiInputPrimitive.Badge className="text-destructive">*</MultiInputPrimitive.Badge>}
                    </MultiInputPrimitive.Label>
                    {description && (
                        <MultiInputPrimitive.Description className="text-xs text-muted-foreground">{description}</MultiInputPrimitive.Description>
                    )}
                </MultiInputPrimitive.Header>

                <MultiInputPrimitive.Group className="grid gap-3">
                    {(fields as any[] || []).map((field: any, i: number) => (
                        <MultiInputPrimitive.Item key={i} className="space-y-1">
                            <MultiInputPrimitive.FieldLabel className="text-[10px] font-semibold text-muted-foreground uppercase">{field.label || `Field ${i + 1}`}</MultiInputPrimitive.FieldLabel>
                            <MultiInputPrimitive.Item className="w-full border-b border-border py-1 text-xs text-muted-foreground/50 italic">
                                {field.value || "text"} input...
                            </MultiInputPrimitive.Item>
                        </MultiInputPrimitive.Item>
                    ))}
                    {(!fields || fields.length === 0) && (
                        <MultiInputPrimitive.Item className="text-xs text-muted-foreground italic">No fields defined</MultiInputPrimitive.Item>
                    )}
                </MultiInputPrimitive.Group>
            </MultiInputPrimitive.Root>
        </BaseNode>
    );
};

export default memo(MultiInputNode);
