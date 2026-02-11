import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconMoodSmile } from '@tabler/icons-react';

const EmojiRatingNode = (props: NodeProps<any>) => {
    const { label, description, options } = props.data;
    const defaultOptions = [
        { label: 'Angry', value: '😠' },
        { label: 'Sad', value: '🙁' },
        { label: 'Neutral', value: '😐' },
        { label: 'Happy', value: '🙂' },
        { label: 'Love', value: '😍' }
    ];

    const displayOptions = options && options.length > 0 ? options : defaultOptions;

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconMoodSmile}
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                        {label || "How do you feel?"}
                    </label>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>

                <div className="flex justify-between gap-1 p-2 bg-muted/30 rounded-lg">
                    {displayOptions.slice(0, 5).map((opt: any, i: number) => (
                        <div key={i} className="flex flex-col items-center justify-center">
                            <span className="text-xl grayscale hover:grayscale-0 cursor-not-allowed opacity-70">
                                {opt.value}
                            </span>
                            {opt.label && (
                                <span className="text-[8px] text-muted-foreground mt-1 truncate max-w-[40px]">
                                    {opt.label}
                                </span>
                            )}
                        </div>
                    ))}
                    {displayOptions.length > 5 && (
                        <div className="flex items-center text-xs text-muted-foreground">...</div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
};

export default memo(EmojiRatingNode);
