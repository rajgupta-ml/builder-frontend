import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconStar } from '@tabler/icons-react';

const RatingNode = (props: NodeProps<any>) => {
    const { label, description, maxRating, items } = props.data;
    const max = maxRating || 5;
    const ratingItems = items || (label ? [{ label: label, value: 'q1' }] : []);

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconStar}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        {label || "Rating Matrix"}
                    </p>
                    {description && (
                        <p className="text-[10px] text-muted-foreground italic truncate">{description}</p>
                    )}
                </div>

                <div className="space-y-2 border-t border-border/50 pt-2">
                    {ratingItems.length > 0 ? (
                        ratingItems.map((item: any, idx: number) => (
                            <div key={idx} className="space-y-1">
                                <p className="text-[10px] font-medium text-foreground truncate">{item.label}</p>
                                <div className="flex gap-0.5">
                                    {Array.from({ length: max }).map((_, i) => (
                                        <IconStar key={i} size={12} className="text-muted-foreground/30" />
                                    ))}
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
