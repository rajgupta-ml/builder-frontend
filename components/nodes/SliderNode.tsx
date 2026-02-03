import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconNumbers } from '@tabler/icons-react';

const SliderNode = (props: NodeProps<any>) => {
    const { label, description, required, min, max, step } = props.data;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconNumbers}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "Slider Question"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="px-1 py-4">
                    <input
                        type="range"
                        min={min || 0}
                        max={max || 100}
                        step={step || 1}
                        className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-not-allowed opacity-80"
                        disabled
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                        <span>{min || 0}</span>
                        <span>{max || 100}</span>
                    </div>
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(SliderNode);
