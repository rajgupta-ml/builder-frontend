"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { cn, generateUniqueId } from "@/lib/utils";
import { FlowDebugger } from '@/lib/flowDebugger';
import { PathAnalysisDrawer } from '@/components/editor/PathAnalysisDrawer';
import type { OpenEndQualityPolicyPreview } from '@/api/surveyWorkflow';
import { buildFlowRelationships } from '@/lib/flowRelationships';

const getId = () => generateUniqueId('node');
const DEFAULT_DEBUG_CANVAS_PERCENT = 32;
const MIN_DEBUG_CANVAS_PERCENT = 20;
const MAX_DEBUG_CANVAS_PERCENT = 65;

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
    onInspectFlowRule?: (inspection: FlowRuleInspection | null) => void;
    analysisOpen?: boolean;
    onAnalysisOpenChange?: (open: boolean) => void;
    qualityPolicies?: Record<string, OpenEndQualityPolicyPreview>;
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
    onInspectFlowRule,
    analysisOpen = false,
    onAnalysisOpenChange,
    qualityPolicies = {},
}: EditorCanvasProps) {
    const { screenToFlowPosition, fitView } = useReactFlow();
    const [debugSession, setDebugSession] = useState<FlowDebugSession | null>(null);
    const [debuggerEngine, setDebuggerEngine] = useState<FlowDebugger | null>(null);
    const [debugError, setDebugError] = useState<string | null>(null);
    const [debugCanvasPercent, setDebugCanvasPercent] = useState(DEFAULT_DEBUG_CANVAS_PERCENT);
    const [isResizingDebugger, setIsResizingDebugger] = useState(false);
    const editorCanvasRef = useRef<HTMLDivElement>(null);
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
    const debugCurrentNode = debugSession && debuggerEngine && !debugSession.finished && debugCurrentNodeId
        ? debuggerEngine.getNode(debugCurrentNodeId)
        : null;
    const debugConditions = debugSession && debuggerEngine && !debugSession.finished && debugCurrentNodeId
        ? debuggerEngine.getConditionSummaries(debugCurrentNodeId)
        : [];

    useEffect(() => {
        if (!analysisOpen || !debugCurrentNodeId) return;
        let fitFrame = 0;
        const layoutFrame = window.requestAnimationFrame(() => {
            fitFrame = window.requestAnimationFrame(() => {
                void fitView({
                    nodes: [{ id: debugCurrentNodeId }],
                    duration: 350,
                    padding: 0.6,
                    maxZoom: 1,
                });
            });
        });
        return () => {
            window.cancelAnimationFrame(layoutFrame);
            window.cancelAnimationFrame(fitFrame);
        };
    }, [analysisOpen, debugCurrentNodeId, fitView]);

    const refitActiveDebugNode = useCallback(() => {
        if (!analysisOpen || !debugCurrentNodeId) return;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                void fitView({
                    nodes: [{ id: debugCurrentNodeId }],
                    duration: 250,
                    padding: 0.6,
                    maxZoom: 1,
                });
            });
        });
    }, [analysisOpen, debugCurrentNodeId, fitView]);

    const resizeDebuggerFromPointer = useCallback((clientY: number) => {
        const bounds = editorCanvasRef.current?.getBoundingClientRect();
        if (!bounds || bounds.height <= 0) return;
        const requestedPercent = ((clientY - bounds.top) / bounds.height) * 100;
        const nextPercent = Math.min(
            MAX_DEBUG_CANVAS_PERCENT,
            Math.max(MIN_DEBUG_CANVAS_PERCENT, requestedPercent),
        );
        setDebugCanvasPercent(Number(nextPercent.toFixed(1)));
    }, []);

    const handleDividerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsResizingDebugger(true);
        resizeDebuggerFromPointer(event.clientY);
    }, [resizeDebuggerFromPointer]);

    const handleDividerPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        resizeDebuggerFromPointer(event.clientY);
    }, [resizeDebuggerFromPointer]);

    const finishDividerResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        setIsResizingDebugger(false);
        refitActiveDebugNode();
    }, [refitActiveDebugNode]);

    const handleDividerKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        let nextPercent: number | null = null;
        if (event.key === 'ArrowUp') nextPercent = debugCanvasPercent - 4;
        if (event.key === 'ArrowDown') nextPercent = debugCanvasPercent + 4;
        if (event.key === 'Home') nextPercent = MIN_DEBUG_CANVAS_PERCENT;
        if (event.key === 'End') nextPercent = MAX_DEBUG_CANVAS_PERCENT;
        if (nextPercent === null) return;
        event.preventDefault();
        setDebugCanvasPercent(Math.min(
            MAX_DEBUG_CANVAS_PERCENT,
            Math.max(MIN_DEBUG_CANVAS_PERCENT, nextPercent),
        ));
        refitActiveDebugNode();
    }, [debugCanvasPercent, refitActiveDebugNode]);

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

    const nodesWithQualityStatus = useMemo<ReactFlowNode[]>(() => {
        const flowRelationships = buildFlowRelationships(nodes);
        return nodes.map((node) => {
            const relationshipData = {
                __flowRelationships: flowRelationships.get(node.id),
                __onInspectFlowRule: onInspectFlowRule,
            };

            if (node.type === 'textInput') {
                const policy = qualityPolicies[node.id];
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...relationshipData,
                        __qualityControl: policy
                            ? { resolved: true, enabled: policy.enabled }
                            : { resolved: false },
                    },
                };
            }

            if (node.type === 'multiInput') {
                const fields = Array.isArray(node.data?.fields)
                    ? (node.data.fields as Array<Record<string, unknown>>)
                    : [];
                if (fields.length === 0) {
                    return { ...node, data: { ...node.data, ...relationshipData } };
                }
                const policies = fields.map((field) => {
                    const fieldId = String(field.id || field.exportId || '');
                    return fieldId ? qualityPolicies[`${node.id}::${encodeURIComponent(fieldId)}`] : undefined;
                });
                const resolved = policies.every(Boolean);
                return {
                    ...node,
                    data: {
                        ...node.data,
                        ...relationshipData,
                        __qualityControl: {
                            resolved,
                            enabled: resolved ? policies.some((policy) => policy?.enabled) : undefined,
                            activeFields: resolved ? policies.filter((policy) => policy?.enabled).length : undefined,
                            totalFields: fields.length,
                        },
                    },
                };
            }

            return { ...node, data: { ...node.data, ...relationshipData } };
        });
    }, [nodes, onInspectFlowRule, qualityPolicies]);

    const displayNodes = useMemo(() => {
        if (debugSession && debuggerEngine) {
            const pathNodeIds = new Set(debugSession.path);
            const currentNodeId = debugSession.path[debugSession.path.length - 1];
            const decisionsByNodeId = new Map<string, string[]>();
            const skippedConditionalNodeIds = new Set<string>();

            debugSession.path.slice(0, -1).forEach((sourceId, index) => {
                const targetId = debugSession.path[index + 1];
                const sourceNode = nodesWithQualityStatus.find((node) => node.id === sourceId);
                const targetNode = nodesWithQualityStatus.find((node) => node.id === targetId);
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
                            const candidate = nodesWithQualityStatus.find((node) => node.id === edge.target);
                            return Boolean(candidate && hasVisibilityCondition(candidate));
                        });
                        if (!skippedEdge) break;
                        skippedConditionalNodeIds.add(skippedEdge.target);
                        skippedSourceId = skippedEdge.target;
                    }
                }
                if (decisions.length > 0) decisionsByNodeId.set(sourceId, decisions);
            });

            return nodesWithQualityStatus.map((node) => {
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
        if (!activeInspection || !shouldDimCanvas) return nodesWithQualityStatus;
        return nodesWithQualityStatus.map((node) => {
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
    }, [nodesWithQualityStatus, edges, debugSession, debuggerEngine, activeInspection, shouldDimCanvas]);

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
            if (isReadOnly || analysisOpen) return;

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
        [analysisOpen, isReadOnly, screenToFlowPosition, nodes, setNodes, setSaveStatus, setSelectedNodeId]
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
            if (analysisOpen) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                duplicateNode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [analysisOpen, duplicateNode]);

    return (
        <div
            ref={editorCanvasRef}
            className={cn(
                'flex-1 h-full relative border-r border-border',
                analysisOpen && 'flex flex-col',
            )}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div
                className={cn('relative min-h-0', analysisOpen ? 'shrink-0' : 'h-full')}
                style={analysisOpen ? { height: `${debugCanvasPercent}%` } : undefined}
            >
                <ReactFlow
                    nodes={displayNodes}
                    edges={displayEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={analysisOpen ? undefined : onNodesChange}
                    onEdgesChange={analysisOpen ? undefined : handleEdgesChange}
                    onConnect={analysisOpen ? undefined : onConnect}
                    onNodeClick={analysisOpen ? undefined : onNodeClick}
                    onPaneClick={analysisOpen ? undefined : onPaneClick}
                    connectionRadius={40}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    className={cn(
                        'bg-muted/10 px-10',
                        analysisOpen && '[&_.react-flow__node]:pointer-events-none [&_.react-flow__handle]:pointer-events-none',
                    )}
                    nodesDraggable={!isReadOnly && !analysisOpen}
                    nodesConnectable={!isReadOnly && !analysisOpen}
                    elementsSelectable={!analysisOpen}
                    nodesFocusable={!analysisOpen}
                    edgesFocusable={!analysisOpen}
                    edgesReconnectable={!isReadOnly && !analysisOpen}
                    deleteKeyCode={analysisOpen ? null : ['Backspace', 'Delete']}
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>
            {analysisOpen && (
                <>
                    <div
                        role="separator"
                        aria-label="Resize flowchart and debugger"
                        aria-orientation="horizontal"
                        aria-valuemin={MIN_DEBUG_CANVAS_PERCENT}
                        aria-valuemax={MAX_DEBUG_CANVAS_PERCENT}
                        aria-valuenow={Math.round(debugCanvasPercent)}
                        tabIndex={0}
                        onPointerDown={handleDividerPointerDown}
                        onPointerMove={handleDividerPointerMove}
                        onPointerUp={finishDividerResize}
                        onPointerCancel={finishDividerResize}
                        onKeyDown={handleDividerKeyDown}
                        className={cn(
                            'group relative z-60 h-3 shrink-0 touch-none cursor-row-resize bg-background outline-none',
                            isResizingDebugger && 'bg-primary/5',
                        )}
                    >
                        <div className="absolute inset-x-0 top-1/2 border-t border-border" />
                        <div className="absolute left-1/2 top-1/2 h-1 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/50 group-focus-visible:bg-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/20 group-focus-visible:ring-offset-2" />
                    </div>
                    <PathAnalysisDrawer
                        currentNode={debugCurrentNode}
                        currentQuestion={debugCurrentQuestion}
                        choices={debugSession && debuggerEngine && !debugSession.finished && debugCurrentNodeId
                            ? debuggerEngine.getChoices(debugCurrentNodeId, debugSession.responses)
                            : []}
                        conditions={debugConditions}
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
                </>
            )}
        </div>
    );
}
