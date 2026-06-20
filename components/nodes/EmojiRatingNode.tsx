import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconMoodSmile } from '@tabler/icons-react';
import { EmojiRatingNode as EmojiPrimitive } from '@surveystudio/node-registery/ui';

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
            <EmojiPrimitive.Root className="space-y-3">
                <EmojiPrimitive.Header className="space-y-1">
                    <EmojiPrimitive.Label className="text-sm font-medium text-foreground">
                        {label || "How do you feel?"}
                    </EmojiPrimitive.Label>
                    {description && (
                        <EmojiPrimitive.Description className="text-xs text-muted-foreground">{description}</EmojiPrimitive.Description>
                    )}
                </EmojiPrimitive.Header>

                <EmojiPrimitive.Group className="flex justify-between gap-1 p-2 bg-muted/30 rounded-lg">
                    {displayOptions.slice(0, 5).map((opt: any, i: number) => (
                        <EmojiPrimitive.Item key={i} className="flex flex-col items-center justify-center">
                            <EmojiPrimitive.Emoji className="text-xl grayscale hover:grayscale-0 cursor-not-allowed opacity-70">
                                {opt.value}
                            </EmojiPrimitive.Emoji>
                            {opt.label && (
                                <EmojiPrimitive.Text className="text-[8px] text-muted-foreground mt-1 truncate max-w-[40px]">
                                    {opt.label}
                                </EmojiPrimitive.Text>
                            )}
                        </EmojiPrimitive.Item>
                    ))}
                    {displayOptions.length > 5 && (
                        <EmojiPrimitive.Item className="flex items-center text-xs text-muted-foreground">...</EmojiPrimitive.Item>
                    )}
                </EmojiPrimitive.Group>
            </EmojiPrimitive.Root>
        </BaseNode>
    );
};

export default memo(EmojiRatingNode);
