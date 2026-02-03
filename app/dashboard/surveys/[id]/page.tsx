"use client"
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import {
    ReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Background,
    Controls,
    type Node as ReactFlowNode,
    type Edge as ReactFlowEdge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    ReactFlowProvider,
    useReactFlow,
    type ReactFlowInstance
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes, edgeTypes, getNodeInitialData } from '@/components/nodes';
import SurveyNodeSidebar from '@/components/SurveyNodeSidebar';
import PropertiesPanel from '@/components/properties/PropertiesPanel';
import NodeViewer from '@/components/NodeViewer';
import { IconCloudUpload, IconCheck, IconAlertCircle, IconLoader2, IconPlayerPlay, IconWorld, IconShare, IconCopy, IconX, IconExternalLink, IconChartBar, IconFilter, IconSettings } from '@tabler/icons-react';
import { validateWorkflow } from '@/lib/validate-workflow';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateUniqueId } from "@/lib/utils";
import { SurveySettingsModal } from '@/components/modals/SurveySettingsModal';
import { SurveyQuotaModal } from '@/components/modals/SurveyQuotaModal';

// Helper to generate unique ID
const getId = () => generateUniqueId('node');

// Helper function to generate runtime JSON (Compiler)
const generateRuntimeJson = (nodes: ReactFlowNode[], edges: ReactFlowEdge[]) => {
    const runtimeJson: Record<string, any> = {};

    // Initialize nodes
    nodes.forEach(node => {
        runtimeJson[node.id] = {
            id: node.id,
            type: node.type,
            data: node.data,
            next: node.type === 'branch'
                ? { kind: 'branch', trueId: null, falseId: null }
                : { kind: 'linear', nextId: null }
        };
    });

    // Populate edges (connections)
    edges.forEach(edge => {
        const sourceNode = runtimeJson[edge.source];
        if (sourceNode) {
            if (sourceNode.next.kind === 'branch') {
                if (edge.sourceHandle === 'true') {
                    sourceNode.next.trueId = edge.target;
                } else if (edge.sourceHandle === 'false') {
                    sourceNode.next.falseId = edge.target;
                }
            } else {
                // Linear connection (take the first one found)
                sourceNode.next.nextId = edge.target;
            }
        }
    });

    return runtimeJson;
};

function SurveyFlow() {
    const params = useParams();
    const router = useRouter();
    const surveyId = params?.id as string;

    // Initial nodes for testing (default, will be overwritten if data exists)
    const [nodes, setNodes] = useState<ReactFlowNode[]>([
        {
            id: 'start-1',
            type: 'start',
            position: { x: 250, y: 50 },
            data: getNodeInitialData('start')
        }
    ]);
    const [edges, setEdges] = useState<ReactFlowEdge[]>([]);

    // Autosave State
    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [publishStatus, setPublishStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
    const isRemoteUpdate = useRef(false); // Flag to prevent autosave when loading data
    const hasLoaded = useRef(false); // Flag to indicate initial data load is complete

    // Selection State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Share Modal State
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuotaOpen, setIsQuotaOpen] = useState(false);

    // Use undefined as initial state for the instance
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | undefined>(undefined);
    const { screenToFlowPosition } = useReactFlow();

    // 1. Fetch Latest Data on Mount
    useEffect(() => {
        async function loadLatest() {
            if (!surveyId) return;
            setSaveStatus('idle'); // Set status to idle while loading
            try {
                const { data } = await apiClient.get(`/workflows/${surveyId}/latest`);
                const workflow = data.data; // Helper: backend returns { data: workflow }

                if (workflow) {
                    if (workflow.designJson) {
                        const { nodes: loadedNodes, edges: loadedEdges, viewport } = workflow.designJson;

                        isRemoteUpdate.current = true; // Prevent autosave from triggering immediately after load

                        setNodes(loadedNodes || []);
                        setEdges(loadedEdges || []);

                        if (viewport && reactFlowInstance) {
                            reactFlowInstance.setViewport(viewport);
                        }
                    }
                    if (workflow.id) {
                        setWorkflowId(workflow.id);
                        setPublishStatus(workflow.status || 'DRAFT');
                    }
                }
                setSaveStatus('saved'); // Data loaded successfully
            } catch (err) {
                console.error("Failed to load workflow", err);
                setSaveStatus('error'); // Indicate error in loading
            } finally {
                hasLoaded.current = true;
            }
        }

        loadLatest();
    }, [surveyId, reactFlowInstance]); // reactFlowInstance dependency to ensure we can set viewport if needed

    // 2. Autosave Effect
    useEffect(() => {
        // Skip if not loaded yet or if surveyId is not available
        if (!hasLoaded.current || !surveyId) return;

        // Skip if this change was caused by loading from remote
        if (isRemoteUpdate.current) {
            isRemoteUpdate.current = false;
            return;
        }

        const autosave = async () => {
            setSaveStatus('saving');

            // 1. Generate Design JSON
            const designJson = reactFlowInstance?.toObject();
            if (!designJson) {
                console.warn("ReactFlow instance not ready for designJson generation.");
                setSaveStatus('error');
                return;
            }

            // 2. Generate Runtime JSON (DAG)
            const runtimeJson = generateRuntimeJson(nodes, edges);

            const payload = {
                surveyId,
                designJson,
                runtimeJson
            };

            try {
                if (workflowId) {
                    // Update existing
                    await apiClient.patch(`/workflows/${workflowId}`, payload);
                    setSaveStatus('saved');
                } else {
                    // Create new
                    const res = await apiClient.post('/workflows', payload);
                    if (res.data?.data?.id) {
                        setWorkflowId(res.data.data.id);
                    }
                    setSaveStatus('saved');
                }
            } catch (error) {
                console.error("Autosave failed", error);
                setSaveStatus('error');
                toast.error("Autosave failed.");
            }
        };

        const timer = setTimeout(autosave, 2000); // 2s debounce
        return () => clearTimeout(timer);

    }, [nodes, edges, surveyId, workflowId, reactFlowInstance]);

    const togglePublish = async () => {
        if (!workflowId) {
            toast.error("Please wait for draft to save first.");
            return;
        }

        // UNPUBLISH LOGIC
        if (publishStatus === 'PUBLISHED') {
            try {
                const promise = apiClient.patch(`/workflows/${workflowId}`, { status: 'DRAFT' });
                toast.promise(promise, {
                    loading: 'Unpublishing Survey...',
                    success: () => {
                        setPublishStatus('DRAFT');
                        return 'Survey Unpublished. Now in Draft mode.';
                    },
                    error: 'Failed to unpublish survey'
                });
                await promise;
            } catch (error) {
                console.error(error);
            }
            return;
        }

        // 1. Validation
        const { isValid, errors } = validateWorkflow(nodes, edges);

        if (!isValid) {
            toast.error("Cannot Publish", {
                description: (
                    <ul className="list-disc pl-4 mt-2 text-xs">
                        {errors.slice(0, 5).map((e, i) => (
                            <li key={i}>{e.message}</li>
                        ))}
                        {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
                    </ul>
                ),
                duration: 5000
            });
            return;
        }

        try {
            const promise = apiClient.patch(`/workflows/${workflowId}`, { status: 'PUBLISHED' });

            toast.promise(promise, {
                loading: 'Publishing Survey...',
                success: () => {
                    setPublishStatus('PUBLISHED');
                    return 'Survey Published Successfully!';
                },
                error: 'Failed to publish survey'
            });

            await promise;

        } catch (error) {
            console.error(error);
        }
    };

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot) as ReactFlowNode[]),
        [],
    );
    // Auto-deselect when clicking empty pane
    const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

    // Select node on click
    const onNodeClick = useCallback((event: React.MouseEvent, node: ReactFlowNode) => {
        setSelectedNodeId(node.id);
    }, []);

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot) as ReactFlowEdge[]),
        [],
    );
    const onConnect: OnConnect = useCallback(
        (params) => setEdges((edgesSnapshot) => addEdge({ ...params, type: 'default' }, edgesSnapshot)),
        [],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/reactflow/label');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Handle ID collision if loading from server - simple check or use UUIDs
            // For now using simple increment but checking existence might be better or using big random
            const newNode: ReactFlowNode = {
                id: getId(),
                type,
                position,
                data: { label: label || `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
            setSelectedNodeId(newNode.id); // Auto-select new node
        },
        [screenToFlowPosition],
    );

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(text);
            toast.success("Link copied to clipboard");
        }
    };

    // Multi-domain architecture links from environment variables
    const surveyBaseUrl = process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:3001';

    // Test/Draft link
    const testLink = `${surveyBaseUrl}/s/${surveyId}?mode=TEST`;

    // Live link
    const liveLink = `${surveyBaseUrl}/s/${surveyId}`;

    return (
        <div className="flex w-full h-screen bg-background overflow-hidden relative">
            <SurveyNodeSidebar />

            <div className="flex-1 h-full relative border-r border-border" onDragOver={onDragOver} onDrop={onDrop}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    className="bg-muted/10 px-10"
                >
                    <Background />
                    <Controls />
                </ReactFlow>

                <NodeViewer nodes={nodes} onSelect={setSelectedNodeId} />

                {/* Top Right Controls & Status */}
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">

                    {/* Live Status Badge */}
                    {publishStatus === 'PUBLISHED' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm rounded-full shadow-sm mr-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-600 font-bold text-[10px] tracking-wider uppercase">Live</span>
                        </div>
                    )}

                    {/* Save Status Indicator */}
                    {(saveStatus === 'saving' || saveStatus === 'saved' || saveStatus === 'error') && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-full shadow-sm text-xs font-medium transition-all mr-2">
                            {saveStatus === 'saving' && (
                                <>
                                    <IconLoader2 className="animate-spin text-primary" size={14} />
                                    <span className="text-muted-foreground">Saving...</span>
                                </>
                            )}
                            {saveStatus === 'saved' && (
                                <>
                                    <IconCheck className="text-emerald-500" size={14} />
                                    <span className="text-foreground">Saved</span>
                                </>
                            )}
                            {saveStatus === 'error' && (
                                <>
                                    <IconAlertCircle className="text-destructive" size={14} />
                                    <span className="text-destructive">Save Failed</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Action Buttons Group */}
                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-md border border-border/60 p-1 rounded-lg shadow-sm">
                        {/* Navigation */}
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${surveyId}/metrics`)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                            title="Metrics"
                        >
                            <IconChartBar size={18} />
                        </button>
                        <button
                            onClick={() => setIsQuotaOpen(true)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                            title="Traffic Control (Quotas)"
                        >
                            <IconFilter size={18} />
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                            title="Settings"
                        >
                            <IconSettings size={18} />
                        </button>

                        <div className="w-px h-4 bg-border mx-1" />

                        {/* Share */}
                        <button
                            onClick={() => setIsShareOpen(true)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                            title="Share Survey"
                        >
                            <IconShare size={18} />
                        </button>

                        <div className="w-px h-4 bg-border mx-1" />

                        {/* Test Button */}
                        <button
                            onClick={() => window.open(testLink, '_blank')}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-all"
                        >
                            <IconPlayerPlay size={16} className="text-blue-500" />
                            Test
                        </button>

                        {/* Live Button (Conditional) */}
                        {publishStatus === 'PUBLISHED' && (
                            <button
                                onClick={() => window.open(liveLink, '_blank')}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-all"
                            >
                                <IconWorld size={16} className="text-emerald-500" />
                                Live
                            </button>
                        )}
                    </div>

                    <div className="w-px h-6 bg-border mx-2" />

                    <button
                        onClick={togglePublish}
                        className={cn(
                            "px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-full shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0",
                            publishStatus === 'PUBLISHED'
                                ? "bg-white text-destructive border border-destructive/20 hover:bg-red-50"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                    >
                        {publishStatus === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </button>
                </div>
            </div>

            {/* Overlays / Modals */}

            {/* Share Dialog Overlay */}
            {isShareOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div
                        className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                            <h3 className="font-semibold text-lg">Share Survey</h3>
                            <button
                                onClick={() => setIsShareOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Test Link Section */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <IconPlayerPlay size={14} /> Test Link (Draft)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={testLink}
                                        className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(testLink)}
                                        className="p-2 bg-background border border-border hover:bg-muted rounded-lg text-foreground transition-colors"
                                        title="Copy Link"
                                    >
                                        <IconCopy size={18} />
                                    </button>
                                    <button
                                        onClick={() => window.open(testLink, '_blank')}
                                        className="p-2 bg-background border border-border hover:bg-muted rounded-lg text-foreground transition-colors"
                                        title="Open in New Tab"
                                    >
                                        <IconExternalLink size={18} />
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">This link shows the latest draft version. Use for testing.</p>
                            </div>

                            {/* Separator */}
                            <div className="h-px bg-border/50" />

                            {/* Live Link Section */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                                    <IconWorld size={14} /> Live Link (Public)
                                </label>
                                {publishStatus === 'PUBLISHED' ? (
                                    <>
                                        <div className="flex gap-2">
                                            <input
                                                readOnly
                                                value={liveLink}
                                                className="flex-1 bg-emerald-50/50 border border-emerald-200/50 rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(liveLink)}
                                                className="p-2 bg-background border border-border hover:bg-muted rounded-lg text-foreground transition-colors"
                                                title="Copy Link"
                                            >
                                                <IconCopy size={18} />
                                            </button>
                                            <button
                                                onClick={() => window.open(liveLink, '_blank')}
                                                className="p-2 bg-background border border-border hover:bg-muted rounded-lg text-foreground transition-colors"
                                                title="Open in New Tab"
                                            >
                                                <IconExternalLink size={18} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">This link shows the currently published version.</p>
                                    </>
                                ) : (
                                    <div className="bg-muted/30 border border-dashed border-border rounded-lg p-4 text-center">
                                        <p className="text-sm text-muted-foreground">Survey is not published yet.</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">Publish only when you are ready to go live.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                            <button
                                onClick={() => setIsShareOpen(false)}
                                className="px-4 py-2 bg-white border border-border text-sm font-medium rounded-md shadow-sm hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Sidebar: Properties Panel */}
            {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (
                <PropertiesPanel
                    node={nodes.find(n => n.id === selectedNodeId) || null}
                    nodes={nodes} // Pass full nodes list for logic building
                    onChange={(fieldName, value) => {
                        setNodes(nds => nds.map(n => {
                            if (n.id === selectedNodeId) {
                                return { ...n, data: { ...n.data, [fieldName]: value } };
                            }
                            return n;
                        }));
                    }}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}

            {/* Quota & Settings Modals */}
            <SurveySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={surveyId}
            />
            <SurveyQuotaModal
                isOpen={isQuotaOpen}
                onClose={() => setIsQuotaOpen(false)}
                surveyId={surveyId}
            />
        </div>
    );
}

export default function App() {
    return (
        <div style={{ width: '100%', height: 'calc(100vh - 64px)' }}> {/* Adjust height for header/nav */}
            <ReactFlowProvider>
                <SurveyFlow />
            </ReactFlowProvider>
        </div>
    );
}