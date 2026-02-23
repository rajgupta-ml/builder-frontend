import React, { memo } from 'react';
import { NodeProps, Position, Handle, useReactFlow } from '@xyflow/react';
import { IconShieldLock, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

const getOutcomeLabel = (outcome?: string) => {
    const normalized = String(outcome || 'security_terminate').toLowerCase();
    if (normalized === 'disqualified') return 'FAIL -> DISQUALIFIED';
    if (normalized === 'dropped') return 'FAIL -> DROPPED';
    return 'FAIL -> SECURITY';
};

const ValidationNode = (props: NodeProps<any>) => {
    const { selected, id, data } = props;
    const { deleteElements } = useReactFlow();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    };

    return (
        <div className={cn(
            "group relative w-[148px] rounded-xl bg-card border-2 px-3 py-2 shadow-sm transition-all duration-200",
            selected ? "border-amber-500 ring-4 ring-amber-500/10 shadow-xl" : "border-amber-500 hover:border-amber-600"
        )}>
            <Handle
                type="target"
                position={Position.Top}
                className="bg-muted-foreground border-2 border-background"
                style={{ width: 10, height: 10 }}
            />

            <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                    <IconShieldLock size={16} className="text-amber-700" />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wide text-amber-700">Validation</div>
                    <div className="text-[11px] font-semibold text-foreground truncate">
                        {String(data?.label || 'Validation Gate')}
                    </div>
                </div>
            </div>

            <div className="mt-2 rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1">
                <div className="text-[9px] font-bold uppercase tracking-wide text-amber-800">
                    {getOutcomeLabel(data?.outcome)}
                </div>
            </div>

            <Handle
                type="source"
                id="true"
                position={Position.Right}
                className="bg-green-500 border-2 border-background"
                style={{ width: 10, height: 10 }}
            />
            <div className="absolute -right-5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-green-500 text-white border-2 border-background shadow-sm flex items-center justify-center pointer-events-none">
                <IconCheck size={10} strokeWidth={3} />
            </div>
            <div className="absolute -right-9 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                PASS
            </div>

            <Handle
                type="source"
                id="false"
                position={Position.Left}
                className="bg-red-500 border-2 border-background"
                style={{ width: 10, height: 10 }}
            />
            <div className="absolute -left-5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-red-500 text-white border-2 border-background shadow-sm flex items-center justify-center pointer-events-none">
                <IconX size={10} strokeWidth={3} />
            </div>
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                FAIL
            </div>

            {selected && (
                <button
                    onClick={handleDelete}
                    className="absolute -top-5 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                    <IconTrash size={12} />
                </button>
            )}
        </div>
    );
};

export default memo(ValidationNode);
