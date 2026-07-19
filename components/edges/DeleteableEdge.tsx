import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    useReactFlow,
    type EdgeProps,
} from '@xyflow/react';
import { IconX } from '@tabler/icons-react';

export default function DeleteableEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    sourceHandleId,
}: EdgeProps) {
    const { setEdges } = useReactFlow();
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setEdges((edges) => edges.filter((edge) => edge.id !== id));
    };

    const route = sourceHandleId === 'true'
        ? {
            label: 'TRUE',
            stroke: '#22c55e',
            badgeClassName: 'border-green-200 bg-green-50 text-green-700',
        }
        : sourceHandleId === 'false'
            ? {
                label: 'FALSE',
                stroke: '#ef4444',
                badgeClassName: 'border-red-200 bg-red-50 text-red-700',
            }
            : sourceHandleId === 'jump'
                ? {
                    label: 'SKIP',
                    stroke: '#f43f5e',
                    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
                }
                : null;

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: route ? 3 : 4,
                    ...(route ? { stroke: route.stroke } : {}),
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 12,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan flex items-center gap-1.5"
                >
                    {route && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm ${route.badgeClassName}`}>
                            {route.label}
                        </span>
                    )}
                    <button
                        className="w-5 h-5 bg-background border border-border shadow-sm rounded-full flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all group"
                        onClick={onEdgeClick}
                        title="Delete Edge"
                    >
                        <IconX size={10} strokeWidth={4} />
                    </button>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
