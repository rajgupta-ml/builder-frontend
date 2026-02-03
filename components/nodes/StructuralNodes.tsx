import React, { memo } from 'react';
import { NodeProps, Position, Handle, useReactFlow } from '@xyflow/react';
import { IconPlayerPlay, IconForbid, IconTrash } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import BaseNode from './BaseNode';

// Start Node - Pill Shape (Terminal)
export const StartNode = memo((props: NodeProps<any>) => {
    const { selected } = props;

    return (
        <div className={cn(
            "group relative px-6 py-3 rounded-full bg-green-500 text-white shadow-md border-2 transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center",
            selected ? "border-green-700 ring-4 ring-green-500/20 shadow-xl" : "border-green-600 hover:border-green-700"
        )}>
            <IconPlayerPlay size={16} fill="white" />
            <div className="flex flex-col text-left leading-tight">
                <span className="font-bold text-sm tracking-wide uppercase">Start</span>
                {props.data?.welcomeMessage && (
                    <span className="text-[10px] opacity-80 font-medium truncate max-w-[100px]">
                        {props.data.welcomeMessage}
                    </span>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 bg-green-600 border-2 border-white"
            />
        </div>
    );
});

// End Node - Pill Shape (Terminal)
export const EndNode = memo((props: NodeProps<any>) => {
    const { selected, id, data } = props;
    const { deleteElements } = useReactFlow();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    };

    return (
        <div className={cn(
            "group relative px-6 py-3 rounded-full bg-destructive text-destructive-foreground shadow-md border-2 transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center",
            selected ? "border-red-800 ring-4 ring-red-500/20 shadow-xl" : "border-red-700 hover:border-red-800"
        )}>
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-red-700 border-2 border-white"
            />

            <IconForbid size={16} />
            <div className="flex flex-col text-left leading-tight">
                <span className="font-bold text-sm tracking-wide uppercase">End</span>
                <span className="text-[10px] opacity-80 uppercase font-semibold">
                    {data?.outcome?.replace(/_/g, ' ') || 'Completed'}
                </span>
            </div>

            {/* Simple delete button appearing on hover/selection for utility */}
            {selected && (
                <button
                    onClick={handleDelete}
                    className="absolute -top-2 -right-2 p-1 bg-white text-destructive rounded-full shadow-sm hover:scale-110 transition-transform border border-border"
                >
                    <IconTrash size={10} />
                </button>
            )}
        </div>
    );
});
