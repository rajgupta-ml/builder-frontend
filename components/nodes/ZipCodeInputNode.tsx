import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconMapPin } from '@tabler/icons-react';
import { TextLikeNode as TextLikePrimitive } from '@surveystudio/node-registery/ui';

const ZipCodeInputNode = (props: NodeProps<any>) => {
    const { label, description, required, placeholder, allowedZips } = props.data;

    const hasValidation = allowedZips && allowedZips.trim().length > 0;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconMapPin}
            color="bg-indigo-500"
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <TextLikePrimitive.Root className="space-y-2">
                <TextLikePrimitive.Header className="space-y-1">
                    <TextLikePrimitive.Label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label || "Zip Code"}
                        {required && <TextLikePrimitive.RequiredMark className="text-destructive">*</TextLikePrimitive.RequiredMark>}
                    </TextLikePrimitive.Label>
                    {description && (
                        <TextLikePrimitive.Description className="text-xs text-muted-foreground">{description}</TextLikePrimitive.Description>
                    )}
                </TextLikePrimitive.Header>

                <TextLikePrimitive.Field className="relative">
                    <TextLikePrimitive.Input
                        type="text"
                        disabled
                        placeholder={placeholder || "12345"}
                        className="w-full px-3 py-2 text-xs rounded-md border border-input bg-background/50 text-muted-foreground cursor-not-allowed"
                    />
                    {hasValidation && (
                        <TextLikePrimitive.Badge className="absolute right-2 top-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">
                            Validation Active
                        </TextLikePrimitive.Badge>
                    )}
                </TextLikePrimitive.Field>

                {hasValidation && (
                    <TextLikePrimitive.Field className="text-[10px] text-muted-foreground/80 flex gap-1">
                        <span className="font-semibold">Allowed:</span>
                        <span className="truncate max-w-[150px]">{allowedZips}</span>
                    </TextLikePrimitive.Field>
                )}
            </TextLikePrimitive.Root>
        </BaseNode>
    );
};

export default memo(ZipCodeInputNode);
