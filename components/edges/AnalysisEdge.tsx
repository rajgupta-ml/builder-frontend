import React from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

/** Read-only overlay connecting consecutive nodes in an analyzed journey. */
export default function AnalysisEdge({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
}: EdgeProps) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        curvature: 0.3,
    });

    return (
        <>
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: 'var(--background)',
                    strokeWidth: 8,
                    strokeLinecap: 'round',
                    opacity: 0.96,
                }}
            />
            <BaseEdge
                path={edgePath}
                style={{
                    stroke: '#16a34a',
                    strokeWidth: 3.5,
                    strokeLinecap: 'round',
                    opacity: 1,
                    filter: 'drop-shadow(0 1px 2px rgb(22 163 74 / 0.4))',
                }}
            />
        </>
    );
}
