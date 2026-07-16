"use client"
import { useCallback, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    type Node as ReactFlowNode,
    type Edge as ReactFlowEdge,
    type EdgeChange,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes, getNodeInitialData } from '@/components/nodes';
import { getNodeSkipRules, isGhostJumpEdge, JUMP_EDGE_ID_PREFIX } from '@/lib/skipMigration';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { generateUniqueId } from "@/lib/utils";

const getId = () => generateUniqueId('node');

export function EditorCanvas() {
    const { screenToFlowPosition } = useReactFlow();
    const {
        nodes,
        edges,
        selectedNodeId,
        onNodesChange,
        onEdgesChange,
        onConnect,
        isReadOnly,
        setNodes,
        setSelectedNodeId,
        setSaveStatus
    } = useSurveyStore();

    // Skip rules live in node data, not in persisted edges. When the source
    // (or jump target) question is selected, show the jump as a ghost edge.
    const displayEdges = useMemo(() => {
        if (!selectedNodeId) return edges;
        const nodeIds = new Set(nodes.map((node) => node.id));
        const jumpEdges: ReactFlowEdge[] = [];
        nodes.forEach((node) => {
            const skips = getNodeSkipRules(node.data);
            if (skips.length === 0) return;
            const isVisible = node.id === selectedNodeId
                || skips.some((rule) => rule.targetId === selectedNodeId);
            if (!isVisible) return;
            skips.forEach((rule, index) => {
                if (!rule.targetId || !nodeIds.has(rule.targetId)) return;
                jumpEdges.push({
                    id: `${JUMP_EDGE_ID_PREFIX}${node.id}-${rule.id || index}`,
                    source: node.id,
                    target: rule.targetId,
                    type: 'jump',
                    selectable: false,
                    deletable: false,
                    focusable: false,
                    data: { label: rule.label },
                });
            });
        });
        return jumpEdges.length > 0 ? [...edges, ...jumpEdges] : edges;
    }, [nodes, edges, selectedNodeId]);

    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        const persistedChanges = changes.filter((change) =>
            !('id' in change) || !isGhostJumpEdge({ id: String(change.id) }));
        if (persistedChanges.length > 0) onEdgesChange(persistedChanges);
    }, [onEdgesChange]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            if (isReadOnly) return;

            const type = event.dataTransfer.getData('application/reactflow');
            if (!type) return;

            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const initialData = getNodeInitialData(type);
            const newNode: any = {
                id: getId(),
                type,
                position,
                data: { ...initialData, label: `${type} node` },
            };

            setNodes([...nodes, newNode]);
            setSaveStatus('unsaved');
            setSelectedNodeId(newNode.id);
        },
        [isReadOnly, screenToFlowPosition, nodes, setNodes, setSaveStatus, setSelectedNodeId]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
        setSelectedNodeId(node.id);
    }, [setSelectedNodeId]);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, [setSelectedNodeId]);

    const { duplicateNode } = useSurveyStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                duplicateNode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [duplicateNode]);

    return (
        <div className="flex-1 h-full relative border-r border-border" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlow
                nodes={nodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                connectionRadius={40}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                className="bg-muted/10 px-10"
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}

            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
}
