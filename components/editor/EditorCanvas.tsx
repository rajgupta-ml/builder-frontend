"use client"
import { useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    type Node as ReactFlowNode,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes, getNodeInitialData } from '@/components/nodes';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { generateUniqueId } from "@/lib/utils";

const getId = () => generateUniqueId('node');

export function EditorCanvas() {
    const { screenToFlowPosition } = useReactFlow();
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        isReadOnly,
        setNodes,
        setSelectedNodeId,
        setSaveStatus
    } = useSurveyStore();

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
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
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
