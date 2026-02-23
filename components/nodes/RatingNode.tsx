import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconStar } from '@tabler/icons-react';

const RatingNode = (props: NodeProps<any>) => {
    const { label, description, maxRating, items, responseMode } = props.data;
    const max = maxRating || 5;
    const effectiveMode = responseMode === 'multi' || (responseMode !== 'single' && Array.isArray(items) && items.length > 0) ? 'multi' : 'single';
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
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "Rating Question"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="space-y-4">
                    {ratingItems.length > 0 ? (
                        ratingItems.map((item: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                                {hasCustomItems && (
                                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                                )}
                                <div className="px-1 py-2">
                                    <div className="flex gap-1.5">
                                        {Array.from({ length: max }).map((_, i) => (
                                            <IconStar key={i} size={13} className="text-muted-foreground/30" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic text-center py-2">Add items in properties</p>
                    )}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(RatingNode);
