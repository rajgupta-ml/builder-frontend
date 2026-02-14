import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconNumbers } from '@tabler/icons-react';

const SliderNode = (props: NodeProps<any>) => {
    const { label, description, required, min, max, step, items } = props.data;

    const sliders = (items && items.length > 0) ? items : [{ label: 'Slider', value: 'default' }];

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconNumbers}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "Slider Question"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="space-y-4">
                    {sliders.map((item: any, idx: number) => (
                        <div key={idx} className="space-y-2">
                            {items && items.length > 0 && (
                                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                            )}
                            <div className="px-1 py-2">
                                <input
                                    type="range"
                                    min={min || 0}
                                    max={max || 10}
                                    step={step || 1}
                                    className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-not-allowed opacity-80"
                                    disabled
                                />
                                <div className="flex justify-between text-[9px] text-muted-foreground mt-1 font-mono">
                                    <span>{min || 0}</span>
                                    <span>{max || 10}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(SliderNode);
