import { type Node as ReactFlowNode } from '@xyflow/react';
export function hydrateNodeIds(
    nodes: ReactFlowNode[],
    runtimeJson: Record<string, any>
): ReactFlowNode[] {
    if (!runtimeJson || typeof runtimeJson !== 'object') return nodes;

    return nodes.map(node => {
        const runtimeNode = runtimeJson[node.id];
        if (!runtimeNode?.data) return node;

        const nodeData = { ...node.data } as Record<string, any>;
        const runtimeData = runtimeNode.data;

        // Copy technicalId
        if (runtimeData.technicalId) {
            nodeData.technicalId = runtimeData.technicalId;
        }

        // Copy exportIds for options (singleChoice, multipleChoice, dropdown, ranking)
        if (runtimeData.options && Array.isArray(nodeData.options)) {
            nodeData.options = (nodeData.options as any[]).map((opt: any, i: number) => ({
                ...opt,
                exportId: runtimeData.options[i]?.exportId || opt.exportId
            }));
        }

        // Copy exportIds for rating items
        if (runtimeData.items && Array.isArray(nodeData.items)) {
            nodeData.items = (nodeData.items as any[]).map((item: any, i: number) => ({
                ...item,
                exportId: runtimeData.items[i]?.exportId || item.exportId
            }));
        }

        // Copy exportIds for matrix rows and columns
        if (runtimeData.rows && Array.isArray(nodeData.rows)) {
            nodeData.rows = (nodeData.rows as any[]).map((row: any, i: number) => ({
                ...row,
                exportId: runtimeData.rows[i]?.exportId || row.exportId
            }));
        }
        if (runtimeData.columns && Array.isArray(nodeData.columns)) {
            nodeData.columns = (nodeData.columns as any[]).map((col: any, i: number) => ({
                ...col,
                exportId: runtimeData.columns[i]?.exportId || col.exportId
            }));
        }

        // Copy exportIds for cascading choice steps and their options
        if (runtimeData.steps && Array.isArray(nodeData.steps)) {
            nodeData.steps = (nodeData.steps as any[]).map((step: any, i: number) => ({
                ...step,
                exportId: runtimeData.steps[i]?.exportId || step.exportId,
                options: step.options?.map((opt: any, j: number) => ({
                    ...opt,
                    exportId: runtimeData.steps[i]?.options?.[j]?.exportId || opt.exportId
                })) || []
            }));
        }

        // Copy exportIds and ids for multiInput fields
        if (runtimeData.fields && Array.isArray(nodeData.fields)) {
            nodeData.fields = (nodeData.fields as any[]).map((field: any, i: number) => ({
                ...field,
                id: runtimeData.fields[i]?.id || field.id,
                exportId: runtimeData.fields[i]?.exportId || field.exportId
            }));
        }

        // Copy exportIds for media node choices
        if (runtimeData.choices && Array.isArray(nodeData.choices)) {
            nodeData.choices = (nodeData.choices as any[]).map((opt: any, i: number) => ({
                ...opt,
                exportId: runtimeData.choices[i]?.exportId || opt.exportId
            }));
        }

        return { ...node, data: nodeData };
    });
}
