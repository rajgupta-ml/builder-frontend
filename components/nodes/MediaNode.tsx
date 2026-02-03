import React, { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import BaseNode from './BaseNode';
import { IconPhoto } from '@tabler/icons-react';
import { cn } from "@/lib/utils";

const MediaNode = (props: NodeProps<any>) => {
    const { url, urls, alt } = props.data;
    const nodeType = props.type;

    const renderContent = () => {
        if (nodeType === 'video' && url) {
            return <video src={url} className="w-full h-full object-cover" controls muted />;
        }

        if (nodeType === 'audio' && url) {
            return (
                <div className="flex flex-col items-center gap-1 text-primary">
                    <IconPhoto size={32} className="opacity-80" />
                    <span className="text-[8px] font-bold uppercase tracking-tighter">Audio Stream</span>
                </div>
            );
        }

        const images = urls || (url ? [url] : []);
        if (images.length > 0) {
            return (
                <div className={cn(
                    "grid w-full h-full gap-0.5",
                    images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                    {images.slice(0, 4).map((img: string, i: number) => (
                        <img
                            key={i}
                            src={img}
                            alt={alt}
                            className={cn(
                                "w-full h-full object-cover",
                                images.length === 3 && i === 0 ? "row-span-2" : ""
                            )}
                        />
                    ))}
                    {images.length > 4 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs font-bold pointer-events-none">
                            +{images.length - 4} more
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <IconPhoto size={24} className="opacity-50" />
                <span className="text-[10px]">No media provided</span>
            </div>
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
            <div className="aspect-video w-full bg-muted rounded-md overflow-hidden flex items-center justify-center border border-border relative">
                {renderContent()}
            </div>
        </BaseNode>
    );
};

export default memo(MediaNode);
