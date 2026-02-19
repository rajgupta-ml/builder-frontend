"use client"
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SurveyNodeSidebar from '@/components/SurveyNodeSidebar';
import PropertiesPanel from '@/components/properties/PropertiesPanel';
import NodeViewer from '@/components/NodeViewer';
import { SurveySettingsModal } from '@/components/modals/SurveySettingsModal';
import { SurveyQuotaModal } from '@/components/modals/SurveyQuotaModal';

import { useSurveyStore } from '@/src/store/useSurveyStore';
import { useAutosave } from '@/src/hooks/useAutosave';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { ShareModal } from '@/components/editor/ShareModal';
import { ValidationDrawer } from '@/components/editor/ValidationDrawer';
import { OnboardingChecklist } from '@/components/editor/OnboardingChecklist';
import { validateWorkflow } from '@/lib/validate-workflow';
import { getNodeInitialData } from '@/components/nodes/definitions';
import { generateUniqueId } from '@/lib/utils';
import { toast } from 'sonner';
import { NodeSearchPalette } from '@/components/editor/NodeSearchPalette';

function SurveyFlow() {
    const { id: surveyIdParam } = useParams();
    const surveyId = Array.isArray(surveyIdParam) ? surveyIdParam[0] : surveyIdParam;

    const {
        nodes,
        edges,
        survey,
        selectedNodeId,
        isReadOnly,
        loadError,
        setNodes,
        setEdges,
        setSelectedNodeId,
        loadSurveyData,
        refreshSurveyData
    } = useSurveyStore();

    // Modal States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuotaOpen, setIsQuotaOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [nodeViewerOpenSignal, setNodeViewerOpenSignal] = useState(0);
    const [isNodeSearchOpen, setIsNodeSearchOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [hasRunTest, setHasRunTest] = useState(false);
    const [hasConfiguredSettings, setHasConfiguredSettings] = useState(false);

    // Load Data
    useEffect(() => {
        if (surveyId) {
            loadSurveyData(surveyId);
        }
    }, [surveyId, loadSurveyData]);

    useEffect(() => {
        if (!surveyId || typeof window === 'undefined') return;
        setHasRunTest(localStorage.getItem(`builder:test-ran:${surveyId}`) === '1');
    }, [surveyId]);

    useEffect(() => {
        if (!survey) return;
        const configured = Boolean(
            survey.redirectUrl ||
            survey.overQuotaUrl ||
            survey.securityTerminateUrl ||
            survey.globalQuota !== null
        );
        setHasConfiguredSettings(configured);
    }, [survey]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsNodeSearchOpen((prev) => !prev);
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
                event.preventDefault();
                setIsSidebarCollapsed((prev) => !prev);
                return;
            }

            const target = event.target as HTMLElement | null;
            const isTyping =
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.tagName === 'SELECT' ||
                Boolean(target?.isContentEditable);
            if (isTyping) return;

            if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId && !isReadOnly) {
                event.preventDefault();
                setNodes(nodes.filter((node) => node.id !== selectedNodeId));
                setEdges(edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
                setSelectedNodeId(null);
            }

            if (event.key === 'Escape') {
                setSelectedNodeId(null);
            }

            if (event.key === '/') {
                event.preventDefault();
                setNodeViewerOpenSignal((prev) => prev + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId, isReadOnly, nodes, edges, setNodes, setEdges, setSelectedNodeId]);

    // Autosave Hook
    useAutosave(surveyId || "");
    const { confirmNavigation } = useUnsavedChangesGuard();
    const validationResult = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);
    const hasQuestionNode = useMemo(
        () => nodes.some((node) => !['start', 'end', 'branch'].includes(node.type || '')),
        [nodes]
    );
    const selectedNode = useMemo(
        () => nodes.find((node) => node.id === selectedNodeId) || null,
        [nodes, selectedNodeId]
    );

    const handleQuickAddFirstQuestion = () => {
        if (isReadOnly) return;
        const type = 'textInput';
        const newNode = {
            id: generateUniqueId('node'),
            type,
            position: { x: 320, y: 180 },
            data: {
                ...getNodeInitialData(type),
                label: 'Question 1',
            },
        };
        setNodes([...nodes, newNode]);
        setSelectedNodeId(newNode.id);
        toast.success("First question added. Configure it from the right panel.");
    };

    const handleAddNodeFromPalette = (type: string, label: string) => {
        if (isReadOnly) return;
        const newNode = {
            id: generateUniqueId('node'),
            type,
            position: { x: 320 + (nodes.length % 3) * 220, y: 180 + Math.floor(nodes.length / 3) * 110 },
            data: {
                ...getNodeInitialData(type),
                label,
            },
        };
        setNodes([...nodes, newNode]);
        setSelectedNodeId(newNode.id);
        toast.success(`${label} added to canvas.`);
    };

    if (!survey && loadError) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background px-6">
                <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Failed to load builder</h2>
                    <p className="text-sm text-muted-foreground">{loadError}</p>
                    <button
                        onClick={() => surveyId && loadSurveyData(surveyId)}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground animate-pulse">Loading Survey Data...</p>
                </div>
            </div>
        );
    }

    const testLink = `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.testSlug}?transactionid=[%%TRANSACTION_ID%%]`

    const liveLink = `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.slug}?transactionid=[%%TRANSACTION_ID%%]`

    const isLive = survey?.status === 'LIVE' || survey?.status === 'PAUSED';

    return (
        <div className="flex w-full h-screen bg-background overflow-hidden relative">
            <SurveyNodeSidebar
                confirmNavigation={confirmNavigation}
                isCollapsed={isSidebarCollapsed}
                onCollapsedChange={setIsSidebarCollapsed}
            />

            <div className="flex-1 h-full relative" >
                <EditorCanvas />

                {!hasQuestionNode && !isReadOnly && (
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                        <div className="pointer-events-auto rounded-xl border border-border bg-background/95 p-5 shadow-lg text-center max-w-sm">
                            <h3 className="text-sm font-semibold mb-1">Start building your survey</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Drag an element from the left, or create your first question instantly.
                            </p>
                            <button
                                onClick={handleQuickAddFirstQuestion}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                            >
                                Quick Add First Question
                            </button>
                        </div>
                    </div>
                )}

                <OnboardingChecklist
                    surveyId={surveyId || ""}
                    hasQuestion={hasQuestionNode}
                    hasConfiguredSettings={hasConfiguredSettings}
                    hasRunTest={hasRunTest}
                />

                <ValidationDrawer
                    issues={validationResult.errors}
                    onFocusNode={(nodeId) => setSelectedNodeId(nodeId)}
                />

                <NodeSearchPalette
                    isOpen={isNodeSearchOpen}
                    onClose={() => setIsNodeSearchOpen(false)}
                    onSelectType={handleAddNodeFromPalette}
                />

                <NodeViewer nodes={nodes} onSelect={setSelectedNodeId} openSignal={nodeViewerOpenSignal} />

                <EditorHeader
                    surveyId={surveyId || ""}
                    setIsQuotaOpen={setIsQuotaOpen}
                    setIsSettingsOpen={setIsSettingsOpen}
                    setIsShareOpen={setIsShareOpen}
                    confirmNavigation={confirmNavigation}
                    onRunTest={() => {
                        if (typeof window !== 'undefined' && surveyId) {
                            localStorage.setItem(`builder:test-ran:${surveyId}`, '1');
                        }
                        setHasRunTest(true);
                    }}
                />
            </div>

            {/* Overlays / Modals */}
            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                testLink={testLink}
                liveLink={liveLink}
                isLive={isLive}
            />

            {/* Right Sidebar: Properties Panel */}
            {selectedNode && (
                <PropertiesPanel
                    node={selectedNode}
                    nodes={nodes}
                    readOnly={isReadOnly}
                    onChange={(fieldName, value) => {
                        if (isReadOnly) return;
                        setNodes(nodes.map(n => {
                            if (n.id === selectedNodeId) return { ...n, data: { ...n.data, [fieldName]: value } };
                            return n;
                        }));
                    }}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}
            {!selectedNode && (
                <div className="absolute right-4 bottom-4 w-72 rounded-xl border border-border bg-background/95 p-4 shadow-lg z-20">
                    <h4 className="text-sm font-semibold mb-1">Nothing selected</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                        Click any node to edit it. Tip: press <kbd className="px-1 rounded border border-border bg-muted">/</kbd> to search nodes quickly.
                    </p>
                </div>
            )}

            <SurveySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={surveyId || ""}
                onSave={() => {
                    setHasConfiguredSettings(true);
                    refreshSurveyData(surveyId || "");
                }}
            />
            <SurveyQuotaModal
                isOpen={isQuotaOpen}
                onClose={() => setIsQuotaOpen(false)}
                surveyId={surveyId || ""}
                onSave={() => refreshSurveyData(surveyId || "")}
            />
        </div>
    );
}

export default function App() {
    return (
        <div style={{ width: '100%', height: 'calc(100vh - 64px)' }}>
            <ReactFlowProvider>
                <SurveyFlow />
            </ReactFlowProvider>
        </div>
    );
}
