import React, { memo } from 'react';
import { NodeProps, Position, Handle, useReactFlow } from '@xyflow/react';
import { IconArrowMerge, IconCheck, IconX, IconTrash } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

const BranchNode = (props: NodeProps<any>) => {
    const { selected, id, data } = props;
    const { deleteElements } = useReactFlow();

    // Default delete action
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting node when clicking delete
        deleteElements({ nodes: [{ id }] });
    };

    return (
        <div className={cn(
            "group relative w-16 h-16 rounded-full flex items-center justify-center bg-card border-2 shadow-sm transition-all duration-200",
            selected ? "border-purple-500 ring-4 ring-purple-500/10 shadow-xl" : "border-purple-500 hover:border-purple-600"
        )}>
            {/* Input Handle - Top */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-muted-foreground border-2 border-background transform -translate-y-1"
            />

            {/* Icon */}
            <IconArrowMerge size={24} className="text-purple-500" />

            {/* True Handle - Right */}
            <Handle
                type="source"
                id="true"
                position={Position.Right}
                className="w-3 h-3 bg-green-500 border-2 border-background transform translate-x-1"
            />
            {/* Label for True */}
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                TRUE
            </div>

            {/* False Handle - Left (User asked for Left/Right handles) */}
            {/* Wait, usually flow goes Left->Right or Top->Bottom. If standard nodes are Top->Bottom, then splitting Left/Right is good. */}
            <Handle
                type="source"
                id="false"
                position={Position.Left}
                className="w-3 h-3 bg-red-500 border-2 border-background transform -translate-x-1"
            />
            {/* Label for False */}
            <div className="absolute -left-9 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                FALSE
            </div>

            {/* Delete button (small overlay) */}
            {selected && (
                <button
                    onClick={handleDelete}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                    <IconTrash size={12} />
                </button>
            )}
        </div>
    );
};

export default memo(BranchNode);
