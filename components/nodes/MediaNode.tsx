import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconPhoto } from '@tabler/icons-react';
import { cn } from "@/lib/utils";
import { MediaPreview } from './MediaPreview';
import { MediaNode as MediaPrimitive } from '@surveystudio/node-registery/ui';

const MediaNode = (props: NodeProps<any>) => {
    const { url, urls, alt } = props.data;
    const nodeType = props.type;

    const renderContent = () => {
        if (nodeType === 'video' && url) {
            return <MediaPreview storageKey={url} type="video" className="w-full h-full" />;
        }

        if (nodeType === 'audio' && url) {
            return (
                <MediaPrimitive.Item className="flex flex-col items-center gap-1 text-primary">
                    <MediaPreview storageKey={url} type="audio" className="w-full h-full" />
                </MediaPrimitive.Item>
            );
        }

        const images = urls || (url ? [url] : []);
        if (images.length > 0) {
            return (
                <MediaPrimitive.Grid className={cn(
                    "grid w-full h-full gap-0.5",
                    images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                    {images.slice(0, 4).map((img: string, i: number) => (
                        <MediaPreview
                            key={i}
                            storageKey={img}
                            type="image"
                            className={cn(
                                "w-full h-full",
                                images.length === 3 && i === 0 ? "row-span-2" : ""
                            )}
                        />
                    ))}
                    {images.length > 4 && (
                        <MediaPrimitive.Badge className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs font-bold pointer-events-none">
                            +{images.length - 4} more
                        </MediaPrimitive.Badge>
                    )}
                </MediaPrimitive.Grid>
            );
        }

        return (
            <MediaPrimitive.Item className="flex flex-col items-center gap-1 text-muted-foreground">
                <IconPhoto size={24} className="opacity-50" />
                <MediaPrimitive.Text className="text-[10px]">No media provided</MediaPrimitive.Text>
            </MediaPrimitive.Item>
        );
    };

    return (
        <BaseNode
            id={props.id}
            selected={props.selected}
            data={props.data}
            icon={IconPhoto}
            color="bg-indigo-500"
            handles={{ source: Position.Bottom, target: Position.Top }}
        >
            <MediaPrimitive.Root className="flex gap-2">
                <MediaPrimitive.Frame className="aspect-video w-full bg-muted rounded-md overflow-hidden flex items-center justify-center border border-border relative">
                    {renderContent()}
                </MediaPrimitive.Frame>
                {props.data.questionLabel && (
                    <MediaPrimitive.Description className="text-xs font-medium text-center px-1 pb-1 text-foreground/80 line-clamp-2">
                        {props.data.questionLabel}
                    </MediaPrimitive.Description>
                )}
            </MediaPrimitive.Root>
        </BaseNode>
    );
};

export default memo(MediaNode);
