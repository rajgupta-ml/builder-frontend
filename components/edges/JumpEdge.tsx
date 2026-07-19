import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    type EdgeProps,
} from '@xyflow/react';
import { IconArrowRampRight } from '@tabler/icons-react';

/**
 * Read-only ghost edge visualizing a skip rule's jump path. These edges are
 * derived from node data when the source (or target) node is selected — they
 * are never persisted in the workflow's edge list.
 */
export default function JumpEdge({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const label = typeof (data as any)?.label === 'string' && (data as any).label.trim().length > 0
        ? (data as any).label
        : 'Skip';

    return (
        <>
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: '#f43f5e',
                    strokeWidth: 2,
                    strokeDasharray: '6 4',
                    opacity: 0.9,
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'none',
                    }}
                    className="nodrag nopan flex max-w-[180px] items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 shadow-sm"
                >
                    <IconArrowRampRight size={11} className="shrink-0 text-rose-600" />
                    <span className="truncate text-[10px] font-bold text-rose-700" title={label}>{label}</span>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
