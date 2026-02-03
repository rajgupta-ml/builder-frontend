import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconListNumbers, IconGridDots } from '@tabler/icons-react';

const RankingNode = (props: NodeProps<any>) => {
    const { label, description, required, options } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconListNumbers}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                        {label || "Rank these items"}
                        {required && <span className="text-destructive">*</span>}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    {(options as any[] || []).map((opt: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card shadow-sm text-xs group-hover:border-primary/30 transition-colors">
                            <div className="bg-muted text-muted-foreground w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold">
                                {i + 1}
                            </div>
                            <span className="flex-1">{opt.label || `Item ${i + 1}`}</span>
                            <IconGridDots size={12} className="text-muted-foreground/50" />
                        </div>
                    ))}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(RankingNode);
