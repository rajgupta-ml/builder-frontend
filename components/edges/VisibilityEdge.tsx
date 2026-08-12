import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    type EdgeProps,
} from '@xyflow/react';
import { IconEye } from '@tabler/icons-react';

/** Read-only dependency edge showing which earlier answer controls a node's visibility. */
export default function VisibilityEdge({
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
        curvature: 0.35,
    });
    const label = typeof (data as any)?.label === 'string' && (data as any).label.trim()
        ? (data as any).label
        : 'Shown conditionally';
    const showLabel = (data as any)?.showLabel !== false;

    return (
        <>
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: 'var(--background)',
                    strokeWidth: 7,
                    strokeDasharray: '2 7',
                    strokeLinecap: 'round',
                    opacity: 0.96,
                }}
            />
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: '#0891b2',
                    strokeWidth: 3,
                    strokeDasharray: '2 7',
                    strokeLinecap: 'round',
                    opacity: 1,
                    filter: 'drop-shadow(0 1px 2px rgb(8 145 178 / 0.35))',
                }}
            />
            {showLabel && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'none',
                            zIndex: 1001,
                        }}
                        className="nodrag nopan flex max-w-[210px] items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 shadow-sm"
                    >
                        <IconEye size={11} className="shrink-0 text-cyan-700" />
                        <span className="truncate text-[10px] font-bold text-cyan-800" title={label}>{label}</span>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
