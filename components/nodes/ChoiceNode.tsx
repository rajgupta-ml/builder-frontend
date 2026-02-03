import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconListDetails, IconCheckbox } from '@tabler/icons-react';

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
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "Choice Question"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                    {isMultiple && props.data.maxChoices > 0 && (
                        <p className="text-[10px] text-primary font-medium italic">
                            Max choices: {props.data.maxChoices}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    {(options as any[] || []).slice(0, 3).map((opt: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-background/50 text-xs">
                            <div className={`w-3 h-3 border border-muted-foreground ${isMultiple ? 'rounded-sm' : 'rounded-full'}`} />
                            <span className="truncate">{opt.label || `Option ${i + 1}`}</span>
                        </div>
                    ))}

                    {(options as any[] || []).length > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center py-1 bg-muted/20 rounded-md border border-dashed border-border">
                            + {(options as any[] || []).length - 3} more options
                        </div>
                    )}

                    {props.data.allowOther && (
                        <div className="flex items-center gap-2 p-2 rounded-md border border-border border-dashed bg-background/30 text-xs text-muted-foreground">
                            <div className={`w-3 h-3 border border-muted-foreground ${isMultiple ? 'rounded-sm' : 'rounded-full'}`} />
                            <span className="italic">{props.data.otherLabel || "Other"}:</span>
                            <div className="flex-1 border-b border-muted-foreground/30 h-4"></div>
                        </div>
                    )}

                    {(!options || options.length === 0) && !props.data.allowOther && (
                        <div className="text-xs text-muted-foreground italic">No options added</div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(ChoiceNode);
