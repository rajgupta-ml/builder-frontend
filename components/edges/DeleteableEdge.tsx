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

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 12,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                >
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
