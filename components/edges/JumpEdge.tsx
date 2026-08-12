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
    const active = (data as any)?.active !== false;

    return (
        <>
            {active && (
                <BaseEdge
                    path={edgePath}
                    style={{
                        stroke: 'var(--background)',
                        strokeWidth: 7,
                        strokeDasharray: '6 4',
                        strokeLinecap: 'round',
                        opacity: 0.96,
                    }}
                />
            )}
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: '#7c3aed',
                    strokeWidth: active ? 3.25 : 1.5,
                    strokeDasharray: '6 4',
                    strokeLinecap: 'round',
                    opacity: active ? 1 : 0.42,
                    filter: active ? 'drop-shadow(0 1px 2px rgb(124 58 237 / 0.35))' : undefined,
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'none',
                        zIndex: active ? 1001 : 11,
                        opacity: active ? 1 : 0.65,
                    }}
                    className="nodrag nopan flex max-w-[180px] items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 shadow-sm"
                >
                    <IconArrowRampRight size={11} className="shrink-0 text-violet-600" />
                    <span className="truncate text-[10px] font-bold text-violet-700" title={label}>{label}</span>
                </div>
            </EdgeLabelRenderer>
        </>
    );
}
