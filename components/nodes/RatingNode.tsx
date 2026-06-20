import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconStar } from '@tabler/icons-react';
import { inferQuestionResponseMode } from '@surveystudio/node-registery/logic';
import { ScaleNode as ScalePrimitive } from '@surveystudio/node-registery/ui';

const RatingNode = (props: NodeProps<any>) => {
    const { label, description, maxRating, items, responseMode } = props.data;
    const max = maxRating || 5;
    const effectiveMode = inferQuestionResponseMode({ responseMode, items });
    const hasCustomItems = effectiveMode === 'multi' && Array.isArray(items) && items.length > 0;
    const ratingItems = hasCustomItems ? items : [{ label: 'Rating', value: 'default' }];

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconStar}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <ScalePrimitive.Root className="space-y-4">
                <ScalePrimitive.Header className="space-y-1">
                    <ScalePrimitive.Label className="text-sm font-medium text-foreground">
                        {label || "Rating Question"}
                    </ScalePrimitive.Label>
                    {description && (
                        <ScalePrimitive.Description className="text-xs text-muted-foreground">{description}</ScalePrimitive.Description>
                    )}
                </ScalePrimitive.Header>

                <ScalePrimitive.Group className="space-y-4">
                    {ratingItems.length > 0 ? (
                        ratingItems.map((item: any, idx: number) => (
                            <ScalePrimitive.Item key={idx} className="space-y-2">
                                {hasCustomItems && (
                                    <ScalePrimitive.Text className="text-xs font-medium text-muted-foreground">{item.label}</ScalePrimitive.Text>
                                )}
                                <ScalePrimitive.Track className="px-1 py-2">
                                    <div className="flex gap-1.5">
                                        {Array.from({ length: max }).map((_, i) => (
                                            <IconStar key={i} size={13} className="text-muted-foreground/30" />
                                        ))}
                                    </div>
                                </ScalePrimitive.Track>
                            </ScalePrimitive.Item>
                        ))
                    ) : (
                        <ScalePrimitive.Description className="text-[10px] text-muted-foreground italic text-center py-2">Add items in properties</ScalePrimitive.Description>
                    )}
                </ScalePrimitive.Group>
            </ScalePrimitive.Root>
        </BaseNode>
    );
};

export default memo(RatingNode);
