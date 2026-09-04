import type { Node } from '@xyflow/react';

// Stable per-survey numbering for "end" nodes, ordered top-to-bottom by
// canvas position (same convention NodeViewer uses for question numbers).
// Used to label end nodes consistently everywhere they're referenced
// (canvas pill, "jump to" target pickers, node search, etc.) so the same
// end node always shows the same number.
export const buildEndNodeSequence = (nodes: Node[]): Map<string, number> => {
    const map = new Map<string, number>();
    const endNodes = nodes
        .filter((node) => node.type === 'end')
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    endNodes.forEach((node, index) => {
        map.set(node.id, index + 1);
    });
    return map;
};
