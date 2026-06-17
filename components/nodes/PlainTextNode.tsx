import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { PlainTextNode as PlainTextPrimitive } from '@surveystudio/node-registery/ui';
import BaseNode from './BaseNode';
import { IconTextCaption } from '@tabler/icons-react';

const PlainTextNode = (props: NodeProps<any>) => {
    const { label, description, buttonLabel } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconTextCaption}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <PlainTextPrimitive.Root className="space-y-3">
                <PlainTextPrimitive.Content className="space-y-1">
                    <PlainTextPrimitive.Title className="text-sm font-medium text-foreground">
                        {label || "Info Screen"}
                    </PlainTextPrimitive.Title>
                    <PlainTextPrimitive.Description className="text-xs text-muted-foreground bg-muted p-2 rounded-md whitespace-pre-wrap max-h-24 overflow-hidden text-ellipsis">
                        {description || "No content provided..."}
                    </PlainTextPrimitive.Description>
                </PlainTextPrimitive.Content>
                <PlainTextPrimitive.Actions className="flex justify-end">
                    <PlainTextPrimitive.Button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded" disabled>
                        {buttonLabel || "Continue"}
                    </PlainTextPrimitive.Button>
                </PlainTextPrimitive.Actions>
            </PlainTextPrimitive.Root>
        </BaseNode>
    );
};

export default memo(PlainTextNode);
