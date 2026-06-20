import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconListDetails, IconCheckbox } from '@tabler/icons-react';
import { ChoiceNode as ChoicePrimitive } from '@surveystudio/node-registery/ui';

const ChoiceNode = (props: NodeProps<any>) => {
    const { label, description, required, options, otherLabel } = props.data;
    const isMultiple = props.type === 'multipleChoice';

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={isMultiple ? IconCheckbox : IconListDetails}
            color="bg-orange-500"
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <ChoicePrimitive.Root className="space-y-3">
                <ChoicePrimitive.Header className="space-y-1">
                    <ChoicePrimitive.Label className="text-sm font-medium text-foreground">
                        {label || "Choice Question"}
                    </ChoicePrimitive.Label>
                    {description && (
                        <ChoicePrimitive.Description className="text-xs text-muted-foreground">{description}</ChoicePrimitive.Description>
                    )}
                    {isMultiple && props.data.maxChoices > 0 && (
                        <ChoicePrimitive.Badge className="text-[10px] text-primary font-medium italic">
                            Max choices: {props.data.maxChoices}
                        </ChoicePrimitive.Badge>
                    )}
                </ChoicePrimitive.Header>

                <ChoicePrimitive.Group className="space-y-1.5">
                    {(options as any[] || []).slice(0, 3).map((opt: any, i: number) => (
                        <ChoicePrimitive.Item key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-background/50 text-xs">
                            <ChoicePrimitive.Indicator className={`w-3 h-3 border border-muted-foreground ${isMultiple ? 'rounded-sm' : 'rounded-full'}`} />
                            <span className="truncate">{opt.label || `Option ${i + 1}`}</span>
                        </ChoicePrimitive.Item>
                    ))}

                    {(options as any[] || []).length > 3 && (
                        <ChoicePrimitive.Item className="text-[10px] text-muted-foreground text-center py-1 bg-muted/20 rounded-md border border-dashed border-border">
                            + {(options as any[] || []).length - 3} more options
                        </ChoicePrimitive.Item>
                    )}

                    {props.data.allowOther && (
                        <ChoicePrimitive.Item className="flex items-center gap-2 p-2 rounded-md border border-border border-dashed bg-background/30 text-xs text-muted-foreground">
                            <ChoicePrimitive.Indicator className={`w-3 h-3 border border-muted-foreground ${isMultiple ? 'rounded-sm' : 'rounded-full'}`} />
                            <span className="italic">{props.data.otherLabel || "Other"}:</span>
                            <ChoicePrimitive.Indicator className="flex-1 border-b border-muted-foreground/30 h-4" />
                        </ChoicePrimitive.Item>
                    )}

                    {(!options || options.length === 0) && !props.data.allowOther && (
                        <ChoicePrimitive.Item className="text-xs text-muted-foreground italic">No options added</ChoicePrimitive.Item>
                    )}
                </ChoicePrimitive.Group>
            </ChoicePrimitive.Root>
        </BaseNode>
    );
};

export default memo(ChoiceNode);
