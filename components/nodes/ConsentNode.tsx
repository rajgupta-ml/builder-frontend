import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconCheckbox } from '@tabler/icons-react';
import { ConsentNode as ConsentPrimitive } from '@surveystudio/node-registery/ui';

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
            <ConsentPrimitive.Root className="space-y-3">
                <ConsentPrimitive.Header className="space-y-1">
                    <ConsentPrimitive.Label className="text-sm font-bold text-foreground">
                        {label || "Terms"}
                        {required && <ConsentPrimitive.Text className="text-destructive">*</ConsentPrimitive.Text>}
                    </ConsentPrimitive.Label>
                </ConsentPrimitive.Header>

                <ConsentPrimitive.Panel className="p-2 bg-muted/30 rounded border border-border text-xs text-muted-foreground h-20 overflow-y-auto">
                    {description || "Terms text goes here..."}
                </ConsentPrimitive.Panel>

                <ConsentPrimitive.Item className="flex items-center gap-2">
                    <ConsentPrimitive.Check className="w-4 h-4 rounded border border-primary bg-primary/20 flex items-center justify-center">
                        {/* Fake check */}
                    </ConsentPrimitive.Check>
                    <ConsentPrimitive.Text className="text-xs font-medium">{checkboxLabel || "I agree"}</ConsentPrimitive.Text>
                </ConsentPrimitive.Item>
            </ConsentPrimitive.Root>
        </BaseNode>
    );
};

export default memo(ConsentNode);
