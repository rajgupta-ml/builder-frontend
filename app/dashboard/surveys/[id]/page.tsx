"use client"
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    type Node as ReactFlowNode,
    type Edge as ReactFlowEdge,
    type OnConnect,
    type NodeChange,
    type EdgeChange,
    applyNodeChanges,
    applyEdgeChanges,
    ReactFlowProvider,
    useReactFlow,
    useNodesState,
    useEdgesState,
    type OnNodesChange,
    type OnEdgesChange,
    type ReactFlowInstance
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes, edgeTypes, getNodeInitialData } from '@/components/nodes';
import SurveyNodeSidebar from '@/components/SurveyNodeSidebar';
import PropertiesPanel from '@/components/properties/PropertiesPanel';
import NodeViewer from '@/components/NodeViewer';
import { IconCheck, IconAlertCircle, IconLoader2, IconPlayerPlay, IconWorld, IconShare, IconCopy, IconX, IconExternalLink, IconChartBar, IconFilter, IconSettings } from '@tabler/icons-react';
import { validateWorkflow } from '@/lib/validate-workflow';
import { toast } from 'sonner';
import { cn, decompressJson } from '@/lib/utils';
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
    const { id: surveyIdParam } = useParams();
    const surveyId = Array.isArray(surveyIdParam) ? surveyIdParam[0] : surveyIdParam;
    const router = useRouter();
    const { screenToFlowPosition } = useReactFlow();

    // 1. ReactFlow State
    const [nodes, setNodes, onNodesChangeInternal] = useNodesState<ReactFlowNode>([]);
    const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<ReactFlowEdge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // 2. Metadata State
    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved');
    const [publishStatus, setPublishStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
    const [survey, setSurvey] = useState<any>(null);
    const [quotas, setQuotas] = useState<any[]>([]);

    // 3. Publish State (Hash-based Change Detection)
    // These hashes are provided by the backend - NO local calculation needed
    const [publishedHashes, setPublishedHashes] = useState<{
        runtime: string | null;
        quotas: string | null;
        settings: string | null;
    }>({ runtime: null, quotas: null, settings: null });

    const [currentHashes, setCurrentHashes] = useState<{
        runtime: string | null;
        quotas: string | null;
        settings: string | null;
    }>({ runtime: null, quotas: null, settings: null });

    // 4. Modal States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuotaOpen, setIsQuotaOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);

    // Helper to refresh current hashes (to detect changes in quotas/settings)
    const refreshCurrentHashes = async () => {
        try {
            const res = await apiClient.get(`/surveys/${surveyId}/element-workflow`);
            if (res.data.data) {
                const { currentHashes: ch, publishedHashes: ph } = res.data.data;
                if (ch) setCurrentHashes(ch);
                if (ph) setPublishedHashes(ph);
                if (res.data.data.status) setPublishStatus(res.data.data.status);
            }
        } catch (err) {
            console.error("Failed to refresh hashes", err);
        }
    };

    const testLink = survey?.testSlug
        ? `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.testSlug}`
        : `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${surveyId}?mode=test`;

    // Live link only exists/is valid if published
    const isLive = publishStatus === 'PUBLISHED';
    const liveLink = survey?.slug
        ? `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.slug}`
        : `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${surveyId}`;

    // 5. Load Data
    useEffect(() => {
        if (!surveyId) return;

        const loadData = async () => {
            try {
                // Fetch Survey Status
                const surveyRes = await apiClient.get(`/surveys/${surveyId}`);
                setSurvey(surveyRes.data.data);
                setPublishStatus(surveyRes.data.data.status);

                // Fetch Quotas
                const quotasRes = await apiClient.get(`/surveys/${surveyId}/quotas`);
                setQuotas(quotasRes.data.data || []);

                // Fetch Workflow (includes hashes)
                const res = await apiClient.get(`/surveys/${surveyId}/element-workflow`);
                if (res.data.data) {
                    const { id, content, runtimeJson, publishedHashes: ph, currentHashes: ch } = res.data.data;
                    setWorkflowId(id);

                    if (ph) setPublishedHashes(ph);
                    if (ch) setCurrentHashes(ch);

                    if (content) {
                        // Restore Nodes/Edges
                        let parsedContent: any = null;

                        try {
                            const inner = typeof content === 'string' ? JSON.parse(content) : content;
                            if (typeof inner === 'string') {
                                parsedContent = decompressJson(inner);
                            } else {
                                parsedContent = inner;
                            }
                        } catch (e) {
                            parsedContent = decompressJson(content);
                        }

                        if (parsedContent && parsedContent.nodes) {
                            setNodes(parsedContent.nodes);
                            if (parsedContent.edges) setEdges(parsedContent.edges);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load survey", err);
                toast.error("Failed to load survey data");
            }
        };

        loadData();
    }, [surveyId, setNodes, setEdges]);

    // 5. Connect Handler
    const onConnect: OnConnect = useCallback((params) => {
        setEdges((eds) => addEdge({ ...params, type: 'custom' }, eds));
        setSaveStatus('unsaved');
    }, [setEdges]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            onNodesChangeInternal(changes);
            setSaveStatus('unsaved');
        },
        [onNodesChangeInternal]
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            onEdgesChangeInternal(changes);
            setSaveStatus('unsaved');
        },
        [onEdgesChangeInternal]
    );

    // 6. Drag & Drop
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            if (!reactFlowInstance) return;

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) return;

            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

            // Get Initial Data based on type
            const initialData = getNodeInitialData(type);
            const newNode: ReactFlowNode = {
                id: getId(),
                type,
                position,
                data: { ...initialData, label: `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
            setSaveStatus('unsaved');

            // Open properties on drop
            setSelectedNodeId(newNode.id);
        },
        [reactFlowInstance, screenToFlowPosition, setNodes]
    );

    // 7. Auto Save
    useEffect(() => {
        if (saveStatus !== 'unsaved' || !surveyId) return;

        const timer = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                const runtimeJson = generateRuntimeJson(nodes, edges);
                const content = JSON.stringify({ nodes, edges });

                const res = await apiClient.post(`/surveys/${surveyId}/element-workflow`, {
                    title: 'Auto Save',
                    content, // Store raw ReactFlow JSON for Builder
                    runtimeJson // Store compiled JSON for Runner
                });

                setWorkflowId(res.data.data.id);

                // Update current hashes from backend response (for change detection)
                if (res.data.data.currentHashes) {
                    setCurrentHashes(res.data.data.currentHashes);
                }

                setSaveStatus('saved');
            } catch (err) {
                console.error("Save failed", err);
                setSaveStatus('error');
            }
        }, 1000); // 1s debounce

        return () => clearTimeout(timer);
    }, [nodes, edges, saveStatus, surveyId]);

    // Change handlers set unsaved
    const onNodeClick = useCallback((_: React.MouseEvent, node: ReactFlowNode) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const isFirstLoad = useRef(true);
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        setSaveStatus('unsaved');
    }, [nodes, edges]);

    // 8. Change Detection (using backend-provided granular hashes)
    const hasChanges = publishStatus === 'PUBLISHED' &&
        publishedHashes.runtime !== null &&
        (currentHashes.runtime !== publishedHashes.runtime ||
            currentHashes.quotas !== publishedHashes.quotas ||
            currentHashes.settings !== publishedHashes.settings);

    const [isPublishing, setIsPublishing] = useState(false);

    const handlePublishLive = async () => {
        if (!workflowId) {
            toast.error("Please wait for draft to save first.");
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

        setIsPublishing(true);
        try {
            const response = await apiClient.post(`/surveys/${surveyId}/publish`, { mode: 'LIVE' });

            // Update publish state with new hashes - now current = published
            const newHashes = response.data.hashes;
            if (newHashes) {
                setPublishedHashes(newHashes);
                setCurrentHashes(newHashes); // After publish, both hashes match
            }
            setPublishStatus('PUBLISHED');

            toast.success(hasChanges ? "Live survey updated successfully!" : "Successfully published to LIVE mode!");
        } catch (error: any) {
            console.error("Publish failed", error);
            const msg = error?.response?.data?.error || "Failed to publish survey";
            toast.error(msg);
        } finally {
            setIsPublishing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Link copied!");
    };

    const [isSyncingTest, setIsSyncingTest] = useState(false);
    const handleQuickTest = async () => {
        setIsSyncingTest(true);
        try {
            // Background sync latest draft to TEST env
            await apiClient.post(`/surveys/${surveyId}/publish`, { mode: 'TEST' });
            window.open(testLink, '_blank');
        } catch (err) {
            console.error("Test sync failed", err);
            toast.error("Failed to sync preview link");
        } finally {
            setIsSyncingTest(false);
        }
    };

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
                    {publishStatus === 'PUBLISHED' && !hasChanges ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm rounded-full shadow-sm mr-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-600 font-bold text-[10px] tracking-wider uppercase">Live</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm rounded-full shadow-sm mr-2" title={hasChanges ? "Changes detected - republish needed" : "Not published yet"}>
                            <IconAlertCircle className="text-amber-500" size={14} />
                            <span className="text-amber-600 font-bold text-[10px] tracking-wider uppercase whitespace-nowrap">
                                {hasChanges ? "Out of Sync" : "Not Published"}
                            </span>
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

                        <button
                            onClick={() => setIsShareOpen(true)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                            title="Share Survey"
                        >
                            <IconShare size={18} />
                        </button>

                        <div className="w-px h-4 bg-border mx-1" />

                        <button
                            onClick={handleQuickTest}
                            disabled={isSyncingTest}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-all disabled:opacity-50"
                        >
                            {isSyncingTest ? (
                                <IconLoader2 className="animate-spin text-blue-500" size={16} />
                            ) : (
                                <IconPlayerPlay size={16} className="text-blue-500" />
                            )}
                            Test
                        </button>
                    </div>

                    <div className="w-px h-6 bg-border mx-2" />

                    {/* Publish Button with Smart States */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePublishLive}
                            disabled={isPublishing || (publishStatus === 'PUBLISHED' && !hasChanges)}
                            className={cn(
                                "px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-full shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                publishStatus !== 'PUBLISHED'
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : hasChanges
                                        ? "bg-amber-600 text-white hover:bg-amber-700"
                                        : "bg-emerald-600 text-white"
                            )}
                            title={hasChanges ? "Configuration has changed since last publish" : undefined}
                        >
                            {isPublishing ? <IconLoader2 className="animate-spin" size={14} /> : null}
                            {publishStatus !== 'PUBLISHED'
                                ? "Publish to Live"
                                : hasChanges
                                    ? "Update Live"
                                    : "Live ✓"
                            }
                        </button>

                        {/* Change Indicator */}
                        {hasChanges && (
                            <div className="text-[10px] text-amber-600 font-medium">
                                Changes detected
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Overlays / Modals */}
            {isShareOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div
                        className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                            <h3 className="font-semibold text-lg">Share Survey</h3>
                            <button onClick={() => setIsShareOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full"><IconX size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <IconPlayerPlay size={14} /> Test Link (Draft)
                                </label>
                                <div className="flex gap-2">
                                    <input readOnly value={testLink} className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                                    <button onClick={() => copyToClipboard(testLink)} className="p-2 bg-background border border-border hover:bg-muted rounded-lg"><IconCopy size={18} /></button>
                                    <button onClick={() => window.open(testLink, '_blank')} className="p-2 bg-background border border-border hover:bg-muted rounded-lg"><IconExternalLink size={18} /></button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                                    <IconWorld size={14} /> Live Link (Public)
                                </label>
                                {isLive ? (
                                    <div className="flex gap-2 animate-in slide-in-from-top-1">
                                        <input readOnly value={liveLink} className="flex-1 bg-emerald-50/50 border border-emerald-200/50 rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                                        <button onClick={() => copyToClipboard(liveLink)} className="p-2 bg-background border border-border hover:bg-muted rounded-lg"><IconCopy size={18} /></button>
                                        <button onClick={() => window.open(liveLink, '_blank')} className="p-2 bg-background border border-border hover:bg-muted rounded-lg"><IconExternalLink size={18} /></button>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-muted/50 border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-center">
                                        <div className="p-2 bg-background rounded-full border border-border shadow-sm">
                                            <IconAlertCircle className="text-muted-foreground" size={20} />
                                        </div>
                                        <p className="text-sm font-medium">Production link is locked</p>
                                        <p className="text-[10px] text-muted-foreground max-w-[200px]">Publish your survey to the Live environment to generate a public link.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                            <button onClick={() => setIsShareOpen(false)} className="px-4 py-2 bg-white border border-border text-sm font-medium rounded-md">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Sidebar: Properties Panel */}
            {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (
                <PropertiesPanel
                    node={nodes.find(n => n.id === selectedNodeId) || null}
                    nodes={nodes}
                    onChange={(fieldName, value) => {
                        setNodes(nds => nds.map(n => {
                            if (n.id === selectedNodeId) return { ...n, data: { ...n.data, [fieldName]: value } };
                            return n;
                        }));
                    }}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}

            {/* Quota & Settings Modals - Publish Modal Removed */}
            <SurveySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={surveyId || ""}
                onSave={refreshCurrentHashes}
            />
            <SurveyQuotaModal
                isOpen={isQuotaOpen}
                onClose={() => setIsQuotaOpen(false)}
                surveyId={surveyId || ""}
                onSave={refreshCurrentHashes}
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