"use client"
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
    ANALYSIS_EDGE_ID_PREFIX,
    getNodeSkipRules,
    getSkipRuleKey,
    isGhostLogicEdge,
    JUMP_EDGE_ID_PREFIX,
    VISIBILITY_EDGE_ID_PREFIX,
    type FlowRuleInspection,
} from '@/lib/skipMigration';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { generateUniqueId } from "@/lib/utils";
import { FlowDebugger } from '@/lib/flowDebugger';
import { PathAnalysisDrawer } from '@/components/editor/PathAnalysisDrawer';
import { RoutePreviewPanel } from '@/components/editor/RoutePreviewPanel';

const getId = () => generateUniqueId('node');

const canvasNodeLabel = (node: ReactFlowNode | undefined) => String(
    node?.data?.label || node?.data?.title || node?.data?.message || node?.type || node?.id || 'Step',
);

const hasVisibilityCondition = (node: ReactFlowNode) => {
    const condition = node.data?.condition;
    if (!condition || typeof condition !== 'object') return false;
    const value = condition as { field?: unknown; children?: unknown[] };
    return Boolean(value.field) || Boolean(value.children?.length);
};

interface EditorCanvasProps {
    inspectedFlowRule?: FlowRuleInspection | null;
    analysisOpen?: boolean;
    onAnalysisOpenChange?: (open: boolean) => void;
}

type FlowDebugSnapshot = {
    path: string[];
    responses: Record<string, unknown>;
    answerLabels: Record<string, string>;
    finished: boolean;
};

type FlowDebugSession = FlowDebugSnapshot & {
    history: FlowDebugSnapshot[];
};

export function EditorCanvas({
    inspectedFlowRule = null,
    analysisOpen = false,
    onAnalysisOpenChange,
}: EditorCanvasProps) {
    const { screenToFlowPosition, fitView } = useReactFlow();
    const [debugSession, setDebugSession] = useState<FlowDebugSession | null>(null);
    const [debuggerEngine, setDebuggerEngine] = useState<FlowDebugger | null>(null);
    const [debugError, setDebugError] = useState<string | null>(null);
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

    const startDebugger = useCallback(() => {
        try {
            const engine = new FlowDebugger(nodes, edges);
            const initial = engine.start();
            setDebuggerEngine(engine);
            setDebugSession({
                path: initial.nodeIds,
                responses: {},
                answerLabels: {},
                finished: initial.finished,
                history: [],
            });
            setDebugError(null);
        } catch (error: any) {
            setDebuggerEngine(null);
            setDebugSession(null);
            setDebugError(String(error?.message || 'Unable to start flow exploration.'));
        }
    }, [nodes, edges]);

    const closeDebugger = useCallback(() => {
        onAnalysisOpenChange?.(false);
        setDebugSession(null);
        setDebuggerEngine(null);
        setDebugError(null);
    }, [onAnalysisOpenChange]);

    useEffect(() => {
        if (!analysisOpen) {
            setDebugSession(null);
            setDebuggerEngine(null);
            setDebugError(null);
            return;
        }
        if (debugSession || debugError) return;
        startDebugger();
    }, [analysisOpen, debugSession, debugError, startDebugger]);

    const handleDebugAnswer = useCallback((value: unknown, preferredLabel?: string) => {
        if (!debuggerEngine || !debugSession || debugSession.finished) return;
        const currentNodeId = debugSession.path[debugSession.path.length - 1];
        if (!currentNodeId || !debuggerEngine.isInteractive(currentNodeId)) return;
        try {
            const snapshot: FlowDebugSnapshot = {
                path: debugSession.path,
                responses: debugSession.responses,
                answerLabels: debugSession.answerLabels,
                finished: debugSession.finished,
            };
            const responses = { ...debugSession.responses, [currentNodeId]: value };
            const answerLabels = {
                ...debugSession.answerLabels,
                [currentNodeId]: debuggerEngine.displayValue(currentNodeId, value, preferredLabel),
            };
            const advanced = debuggerEngine.advanceFrom(currentNodeId, responses);
            setDebugSession({
                path: [...debugSession.path, ...advanced.nodeIds],
                responses,
                answerLabels,
                finished: advanced.finished,
                history: [...debugSession.history, snapshot],
            });
            setDebugError(null);
        } catch (error: any) {
            setDebugError(String(error?.message || 'Unable to continue this flow.'));
        }
    }, [debugSession, debuggerEngine]);

    const handleDebugBack = useCallback(() => {
        setDebugSession((session) => {
            if (!session || session.history.length === 0) return session;
            const previous = session.history[session.history.length - 1];
            return { ...previous, history: session.history.slice(0, -1) };
        });
        setDebugError(null);
    }, []);

    const handleDebugRestart = useCallback(() => {
        if (!debuggerEngine) return;
        try {
            const initial = debuggerEngine.start();
            setDebugSession({ path: initial.nodeIds, responses: {}, answerLabels: {}, finished: initial.finished, history: [] });
            setDebugError(null);
        } catch (error: any) {
            setDebugError(String(error?.message || 'Unable to restart flow exploration.'));
        }
    }, [debuggerEngine]);

    const debugCurrentNodeId = debugSession?.path[debugSession.path.length - 1] || null;
    const debugCurrentQuestion = debugSession && debuggerEngine && !debugSession.finished && debugCurrentNodeId
        ? debuggerEngine.nodeLabel(debugCurrentNodeId)
        : null;
    const debugConditions = debugSession && debuggerEngine && !debugSession.finished && debugCurrentNodeId
        ? debuggerEngine.getConditionSummaries(debugCurrentNodeId)
        : [];

    useEffect(() => {
        if (!analysisOpen || !debugCurrentNodeId) return;
        const animationFrame = window.requestAnimationFrame(() => {
            void fitView({
                nodes: [{ id: debugCurrentNodeId }],
                duration: 350,
                padding: 1.2,
                maxZoom: 1,
            });
        });
        return () => window.cancelAnimationFrame(animationFrame);
    }, [analysisOpen, debugCurrentNodeId, fitView]);

    const inspectedJumpRule = useMemo(() => {
        if (inspectedFlowRule?.kind !== 'jump') return null;
        const sourceNode = nodes.find((node) => node.id === inspectedFlowRule.sourceId);
        if (!sourceNode) return null;
        const rule = getNodeSkipRules(sourceNode.data).find((candidate, index) => (
            getSkipRuleKey(candidate, index) === inspectedFlowRule.ruleId
        ));
        if (!rule?.targetId || !nodes.some((node) => node.id === rule.targetId)) return null;
        return { sourceId: sourceNode.id, targetId: rule.targetId };
    }, [nodes, inspectedFlowRule]);

    const inspectedVisibilityRule = useMemo(() => {
        if (inspectedFlowRule?.kind !== 'visibility') return null;
        if (!nodes.some((node) => node.id === inspectedFlowRule.targetId)) return null;
        const nodeIds = new Set(nodes.map((node) => node.id));
        return {
            targetId: inspectedFlowRule.targetId,
            sourceIds: inspectedFlowRule.sourceIds.filter((id) => nodeIds.has(id)),
            label: inspectedFlowRule.label,
        };
    }, [nodes, inspectedFlowRule]);

    const activeInspection = useMemo(() => (
        inspectedJumpRule
            ? { kind: 'jump' as const, sourceIds: [inspectedJumpRule.sourceId], targetId: inspectedJumpRule.targetId }
            : inspectedVisibilityRule
                ? { kind: 'visibility' as const, sourceIds: inspectedVisibilityRule.sourceIds, targetId: inspectedVisibilityRule.targetId }
                : null
    ), [inspectedJumpRule, inspectedVisibilityRule]);
    const shouldDimCanvas = Boolean(debugSession || activeInspection);

    const displayNodes = useMemo(() => {
        if (debugSession && debuggerEngine) {
            const pathNodeIds = new Set(debugSession.path);
            const currentNodeId = debugSession.path[debugSession.path.length - 1];
            const decisionsByNodeId = new Map<string, string[]>();
            const skippedConditionalNodeIds = new Set<string>();

            debugSession.path.slice(0, -1).forEach((sourceId, index) => {
                const targetId = debugSession.path[index + 1];
                const sourceNode = nodes.find((node) => node.id === sourceId);
                const targetNode = nodes.find((node) => node.id === targetId);
                if (!sourceNode) return;
                const decisions: string[] = [];
                const jumpRule = getNodeSkipRules(sourceNode.data).find((rule) => rule.targetId === targetId);
                const persistedEdge = edges.find((edge) => edge.source === sourceId && edge.target === targetId);
                const sourceHandle = String(persistedEdge?.sourceHandle || '');

                if (jumpRule) {
                    decisions.push(`Jump matched → ${canvasNodeLabel(targetNode)}`);
                } else if (sourceNode.type === 'validation' && sourceHandle) {
                    decisions.push(sourceHandle === 'true' ? 'PASS path' : 'FAIL path');
                } else if (sourceNode.type === 'branch' && sourceHandle) {
                    decisions.push(sourceHandle === 'true' ? 'TRUE path' : 'FALSE path');
                } else if (sourceNode.type === 'branchOut' && sourceHandle) {
                    const routes = Array.isArray(sourceNode.data?.routes) ? sourceNode.data.routes as any[] : [];
                    const route = routes.find((candidate) => String(candidate?.id) === sourceHandle);
                    decisions.push(sourceHandle === 'fallback'
                        ? String(sourceNode.data?.fallbackLabel || 'Otherwise')
                        : String(route?.label || 'Matched route'));
                }
                if (!jumpRule && !persistedEdge) {
                    let skippedSourceId = sourceId;
                    const seenSkipped = new Set<string>();
                    while (!seenSkipped.has(skippedSourceId)) {
                        seenSkipped.add(skippedSourceId);
                        const skippedEdge = edges.find((edge) => {
                            if (edge.source !== skippedSourceId || pathNodeIds.has(edge.target)) return false;
                            const candidate = nodes.find((node) => node.id === edge.target);
                            return Boolean(candidate && hasVisibilityCondition(candidate));
                        });
                        if (!skippedEdge) break;
                        skippedConditionalNodeIds.add(skippedEdge.target);
                        skippedSourceId = skippedEdge.target;
                    }
                }
                if (decisions.length > 0) decisionsByNodeId.set(sourceId, decisions);
            });

            return nodes.map((node) => {
                const isOnPath = pathNodeIds.has(node.id);
                const isSkipped = skippedConditionalNodeIds.has(node.id);
                const isCurrent = node.id === currentNodeId;
                const outcome = debuggerEngine.outcome(node.id);
                const decisions = [...(decisionsByNodeId.get(node.id) || [])];
                if (isOnPath && hasVisibilityCondition(node)) decisions.unshift('Shown by condition');
                const isActiveQuestion = isCurrent && !debugSession.finished && debuggerEngine.isInteractive(node.id);
                return {
                    ...node,
                    data: isOnPath || isSkipped ? {
                        ...node.data,
                        __pathAnalysis: isSkipped ? {
                            skipped: true,
                        } : {
                            answer: debugSession.answerLabels[node.id],
                            decisions,
                            active: isActiveQuestion,
                        },
                    } : node.data,
                    className: [
                        node.className,
                        'transition-opacity duration-150',
                        isActiveQuestion ? 'ring-4 ring-sky-300/80 rounded-xl z-10' : '',
                        outcome && outcome.toUpperCase().includes('COMPLET') ? 'ring-4 ring-emerald-300/80 rounded-xl z-10' : '',
                        outcome && !outcome.toUpperCase().includes('COMPLET') ? 'ring-4 ring-rose-300/80 rounded-xl z-10' : '',
                    ].filter(Boolean).join(' '),
                    style: { ...node.style, opacity: isOnPath ? 1 : isSkipped ? 0.48 : 0.12 },
                };
            });
        }
        if (!activeInspection || !shouldDimCanvas) return nodes;
        return nodes.map((node) => {
            const isSource = activeInspection.sourceIds.includes(node.id);
            const isTarget = node.id === activeInspection.targetId;
            const inspectionColor = activeInspection.kind === 'visibility' ? 'cyan' : 'violet';
            return {
                ...node,
                className: [
                    node.className,
                    'transition-opacity duration-150',
                    isTarget && inspectionColor === 'cyan' ? 'ring-4 ring-cyan-300/80 rounded-xl z-10' : '',
                    isTarget && inspectionColor === 'violet' ? 'ring-4 ring-violet-300/70 rounded-xl z-10' : '',
                    isSource && inspectionColor === 'cyan' ? 'ring-2 ring-cyan-300/70 rounded-xl z-10' : '',
                ].filter(Boolean).join(' '),
                style: { ...node.style, opacity: isSource || isTarget ? 1 : 0.18 },
            };
        });
    }, [nodes, edges, debugSession, debuggerEngine, activeInspection, shouldDimCanvas]);

    // Flow rules live in node data, not persisted edges. Keep the normal canvas
    // clean and reveal only the dependency being inspected.
    const displayEdges = useMemo(() => {
        const nodeIds = new Set(nodes.map((node) => node.id));
        const jumpEdges: ReactFlowEdge[] = [];
        if (!debugSession) nodes.forEach((node) => {
            const skips = getNodeSkipRules(node.data);
            if (skips.length === 0) return;
            skips.forEach((rule, index) => {
                const isInspected = inspectedFlowRule?.kind === 'jump'
                    && inspectedFlowRule.sourceId === node.id
                    && inspectedFlowRule.ruleId === getSkipRuleKey(rule, index);
                if (!isInspected) return;
                if (!rule.targetId || !nodeIds.has(rule.targetId)) return;
                jumpEdges.push({
                    id: `${JUMP_EDGE_ID_PREFIX}${node.id}-${getSkipRuleKey(rule, index)}`,
                    source: node.id,
                    target: rule.targetId,
                    type: 'jump',
                    selectable: false,
                    deletable: false,
                    focusable: false,
                    zIndex: isInspected ? 1000 : 10,
                    data: { label: rule.label, active: isInspected },
                });
            });
        });

        const visibilityEdges: ReactFlowEdge[] = !debugSession && inspectedVisibilityRule
            ? inspectedVisibilityRule.sourceIds.map((sourceId, index) => ({
                id: `${VISIBILITY_EDGE_ID_PREFIX}${sourceId}-${inspectedVisibilityRule.targetId}`,
                source: sourceId,
                target: inspectedVisibilityRule.targetId,
                type: 'visibility',
                selectable: false,
                deletable: false,
                focusable: false,
                zIndex: 1000,
                data: {
                    label: inspectedVisibilityRule.label,
                    showLabel: index === 0,
                },
            }))
            : [];
        const analysisEdges: ReactFlowEdge[] = debugSession
            ? debugSession.path.slice(0, -1).map((sourceId, index) => {
                const targetId = debugSession.path[index + 1];
                const persistedEdge = edges.find((edge) => edge.source === sourceId && edge.target === targetId);
                return {
                    id: `${ANALYSIS_EDGE_ID_PREFIX}debug-${index}`,
                    source: sourceId,
                    target: targetId,
                    sourceHandle: persistedEdge?.sourceHandle,
                    targetHandle: persistedEdge?.targetHandle,
                    type: 'analysis',
                    selectable: false,
                    deletable: false,
                    focusable: false,
                    zIndex: 1000,
                };
            })
            : [];
        const baseEdges = shouldDimCanvas
            ? edges.map((edge) => ({
                ...edge,
                style: { ...edge.style, opacity: debugSession ? 0.08 : 0.1, transition: 'opacity 150ms ease' },
            }))
            : edges;
        return [...baseEdges, ...jumpEdges, ...visibilityEdges, ...analysisEdges];
    }, [nodes, edges, debugSession, inspectedFlowRule, inspectedVisibilityRule, shouldDimCanvas]);

    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        const persistedChanges = changes.filter((change) =>
            !('id' in change) || !isGhostLogicEdge({ id: String(change.id) }));
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
                nodes={displayNodes}
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
                nodesDraggable={!isReadOnly && !analysisOpen}
                nodesConnectable={!isReadOnly && !analysisOpen}

            >
                <Background />
                <Controls />
            </ReactFlow>
            {analysisOpen && (
                <>
                    <PathAnalysisDrawer
                        hasRoutePreview={debugConditions.length > 0}
                        currentNodeId={debugCurrentNodeId}
                        currentQuestion={debugCurrentQuestion}
                        choices={debugSession && debuggerEngine && !debugSession.finished && debugCurrentNodeId
                            ? debuggerEngine.getChoices(debugCurrentNodeId, debugSession.responses)
                            : []}
                        inputType={debugCurrentNodeId && debuggerEngine ? debuggerEngine.inputType(debugCurrentNodeId) : 'text'}
                        allowCustom={Boolean(debugCurrentNodeId && debuggerEngine?.allowsCustomAnswer(debugCurrentNodeId))}
                        onAnswer={handleDebugAnswer}
                        answeredCount={debugSession ? Object.keys(debugSession.answerLabels).length : 0}
                        pathLength={debugSession?.path.length || 0}
                        finished={Boolean(debugSession?.finished)}
                        outcome={debuggerEngine?.outcome(debugSession?.path[debugSession.path.length - 1]) || null}
                        error={debugError}
                        canGoBack={Boolean(debugSession?.history.length)}
                        onBack={handleDebugBack}
                        onRestart={handleDebugRestart}
                        onClose={closeDebugger}
                    />
                    <RoutePreviewPanel conditions={debugConditions} currentQuestion={debugCurrentQuestion} />
                </>
            )}
        </div>
    );
}
