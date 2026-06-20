import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconNumbers } from '@tabler/icons-react';
import { inferQuestionResponseMode } from '@surveystudio/node-registery/logic';
import { ScaleNode as ScalePrimitive } from '@surveystudio/node-registery/ui';

const SliderNode = (props: NodeProps<any>) => {
    const { label, description, required, min, max, step, items, responseMode } = props.data;
    const effectiveMode = inferQuestionResponseMode({ responseMode, items });

    const sliders = (effectiveMode === 'multi' && items && items.length > 0) ? items : [{ label: 'Slider', value: 'default' }];

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconNumbers}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <ScalePrimitive.Root className="space-y-4">
                <ScalePrimitive.Header className="space-y-1">
                    <ScalePrimitive.Label className="text-sm font-medium text-foreground">
                        {label || "Slider Question"}
                    </ScalePrimitive.Label>
                    {description && (
                        <ScalePrimitive.Description className="text-xs text-muted-foreground">{description}</ScalePrimitive.Description>
                    )}
                </ScalePrimitive.Header>

                <ScalePrimitive.Group className="space-y-4">
                    {sliders.map((item: any, idx: number) => (
                        <ScalePrimitive.Item key={idx} className="space-y-2">
                            {effectiveMode === 'multi' && items && items.length > 0 && (
                                <ScalePrimitive.Text className="text-xs font-medium text-muted-foreground">{item.label}</ScalePrimitive.Text>
                            )}
                            <ScalePrimitive.Track className="px-1 py-2">
                                <ScalePrimitive.Range
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
                            </ScalePrimitive.Track>
                        </ScalePrimitive.Item>
                    ))}
                </ScalePrimitive.Group>
            </ScalePrimitive.Root>
        </BaseNode>
    );
};

export default memo(SliderNode);
