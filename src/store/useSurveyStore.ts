import { create } from 'zustand';
import { 
    type Node as ReactFlowNode, 
    type Edge as ReactFlowEdge,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect
} from '@xyflow/react';
import { surveyApi } from '@/api/survey';
import { surveyWorkflowApi } from '@/api/surveyWorkflow';
import { quotaApi } from '@/api/quota';
import { toast } from 'sonner';
import { Survey, SurveyQuota } from '@/src/shared/types/survey';
import { hydrateNodeIds } from '@/lib/hydrateNodeIds';
import { toUserMessage } from '@/lib/api-error';

interface SurveyState {
    // ReactFlow state
    nodes: ReactFlowNode[];
    edges: ReactFlowEdge[];
    selectedNodeId: string | null;

    // Metadata
    survey: Survey | any | null;
    quotas: SurveyQuota[];
    versions: any[];
    workflowId: string | null;
    
    // Status
    saveStatus: 'saved' | 'saving' | 'error' | 'unsaved';
    isPublishing: boolean;
    isSyncingTest: boolean;
    isReadOnly: boolean;
    selectedVersionId: string | null;

    // Computed
    hasChanges: boolean;
    loadRequestId: number;
    autosaveInFlight: boolean;
    autosavePending: boolean;
    autosavePendingRuntimeJson: any | null;
    autosaveRequestSeq: number;

    // Actions
    setNodes: (nodes: ReactFlowNode[]) => void;
    setEdges: (edges: ReactFlowEdge[]) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setSelectedNodeId: (id: string | null) => void;
    setSaveStatus: (status: 'saved' | 'saving' | 'error' | 'unsaved') => void;

    // Data Loaders
    loadSurveyData: (surveyId: string) => Promise<void>;
    refreshSurveyData: (surveyId: string) => Promise<void>;
    
    // Workflow Actions
    autosave: (surveyId: string, runtimeJson: any) => Promise<void>;
    publish: (surveyId: string, mode: 'LIVE' | 'TEST') => Promise<void>;
    pause: (surveyId: string) => Promise<void>;
    close: (surveyId: string) => Promise<void>;
    resume: (surveyId: string) => Promise<void>;
    selectVersion: (surveyId: string, versionId: string | null) => Promise<void>;
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    survey: null,
    quotas: [],
    versions: [],
    workflowId: null,
    saveStatus: 'saved',
    isPublishing: false,
    isSyncingTest: false,
    isReadOnly: false,
    selectedVersionId: null,
    hasChanges: false,
    loadRequestId: 0,
    autosaveInFlight: false,
    autosavePending: false,
    autosavePendingRuntimeJson: null,
    autosaveRequestSeq: 0,

    setNodes: (nodes) => set({ nodes, saveStatus: 'unsaved' }),
    setEdges: (edges) => set({ edges, saveStatus: 'unsaved' }),

    onNodesChange: (changes) => {
        const { nodes, isReadOnly } = get();
        if (isReadOnly) return;
        set({ 
            nodes: applyNodeChanges(changes, nodes),
            saveStatus: 'unsaved'
        });
    },

    onEdgesChange: (changes) => {
        const { edges, isReadOnly } = get();
        if (isReadOnly) return;
        set({ 
            edges: applyEdgeChanges(changes, edges),
            saveStatus: 'unsaved'
        });
    },

    onConnect: (connection) => {
        const { edges, isReadOnly } = get();
        if (isReadOnly) return;
        set({ 
            edges: addEdge({ ...connection, type: 'custom' }, edges),
            saveStatus: 'unsaved'
        });
    },

    setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),

    loadSurveyData: async (surveyId) => {
        const requestId = get().loadRequestId + 1;
        set({ loadRequestId: requestId });
        try {
            const [survey, versions, quotas, workflow] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId),
                quotaApi.getQuotas(surveyId),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId)
            ]);

            if (get().loadRequestId !== requestId) {
                return;
            }

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';

            // Hydrate design nodes with stable IDs from runtimeJson
            // so generateRuntimeJson won't regenerate UUIDs on autosave
            const rawNodes = workflow?.designJson?.nodes || [];
            const hydratedNodes = workflow?.runtimeJson 
                ? hydrateNodeIds(rawNodes, workflow.runtimeJson) 
                : rawNodes;

            set({
                survey,
                versions,
                quotas,
                workflowId: workflow?.id || null,
                nodes: hydratedNodes,
                edges: workflow?.designJson?.edges || [],
                hasChanges: hasDbChanges,
                saveStatus: 'saved' // Prevent autosave from triggering on initial load
            });
        } catch (err) {
            console.error("Failed to load survey data", err);
            if (get().loadRequestId === requestId) {
                toast.error(toUserMessage(err, "Failed to load survey data"));
            }
        }
    },

    refreshSurveyData: async (surveyId) => {
        const requestId = get().loadRequestId + 1;
        set({ loadRequestId: requestId });
        try {
            const [survey, versions] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId)
            ]);
            if (get().loadRequestId !== requestId) {
                return;
            }

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';

            set({ 
                survey, 
                versions,
                hasChanges: hasDbChanges
            });
        } catch (err) {
            console.error("Failed to refresh survey data", err);
            if (get().loadRequestId === requestId) {
                toast.error(toUserMessage(err, "Failed to refresh survey data"));
            }
        }
    },

    autosave: async (surveyId, runtimeJson) => {
        const state = get();
        if (state.autosaveInFlight) {
            set({
                autosavePending: true,
                autosavePendingRuntimeJson: runtimeJson,
                saveStatus: 'unsaved',
            });
            return;
        }

        const { nodes, edges, workflowId } = get();
        const requestSeq = get().autosaveRequestSeq + 1;
        set({
            saveStatus: 'saving',
            autosaveInFlight: true,
            autosaveRequestSeq: requestSeq,
        });

        try {
            const data = await surveyWorkflowApi.autosaveWorkflow({
                surveyId,
                workflowId,
                designJson: { nodes, edges },
                runtimeJson
            });
            
            // Refresh versions to update change detection
            const versions = await surveyWorkflowApi.getWorkflowsMetadata(surveyId);
            if (get().autosaveRequestSeq !== requestSeq) {
                return;
            }

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';

            set({ 
                workflowId: data.id, 
                saveStatus: 'saved',
                versions,
                hasChanges: hasDbChanges
            });
        } catch (err) {
            console.error("Save failed", err);
            if (get().autosaveRequestSeq === requestSeq) {
                set({ saveStatus: 'error' });
            }
        } finally {
            const hasPending = get().autosavePending;
            const pendingRuntimeJson = get().autosavePendingRuntimeJson;
            set({
                autosaveInFlight: false,
                autosavePending: false,
                autosavePendingRuntimeJson: null,
            });

            if (hasPending && pendingRuntimeJson) {
                void get().autosave(surveyId, pendingRuntimeJson);
            }
        }
    },

    publish: async (surveyId, mode) => {
        if (mode === 'LIVE') set({ isPublishing: true });
        else set({ isSyncingTest: true });

        try {
            await surveyApi.publish(surveyId, mode);
            
            // Refresh all data
            const [survey, versions] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId)
            ]);

            set({ 
                survey, 
                versions,
                hasChanges: false
            });

            if (mode === 'LIVE') toast.success("Successfully published to LIVE mode!");
        } catch (error) {
            console.error("Publish failed", error);
            toast.error(toUserMessage(error, "Failed to publish survey"));
        } finally {
            if (mode === 'LIVE') set({ isPublishing: false });
            else set({ isSyncingTest: false });
        }
    },

    pause: async (surveyId) => {
        try {
            await surveyApi.pause(surveyId);
            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Paused");
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to pause"));
        }
    },

    close: async (surveyId) => {
        try {
            await surveyApi.close(surveyId);
            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Closed");
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to close"));
        }
    },

    resume: async (surveyId) => {
        try {
            await surveyApi.publish(surveyId, 'LIVE');
            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Resumed");
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to resume"));
        }
    },

    selectVersion: async (surveyId, versionId) => {
        set({ selectedVersionId: versionId });
        if (versionId) {
            set({ isReadOnly: true });
            try {
                const data = await surveyWorkflowApi.getWorkflowById(versionId);
                if (data && data.designJson) {
                    set({
                        nodes: data.designJson.nodes || [],
                        edges: data.designJson.edges || [],
                        workflowId: data.id,
                        saveStatus: 'saved' // Prevent autosave when viewing version history
                    });
                }
            } catch (err) {
                console.error("Failed to load version", err);
                toast.error("Failed to load version history");
            }
        } else {
            set({ isReadOnly: false });
            try {
                // Instead of reload, we should re-fetch current latest
                const workflow = await surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId);
                const rawNodes = workflow?.designJson?.nodes || [];
                const hydratedNodes = workflow?.runtimeJson 
                    ? hydrateNodeIds(rawNodes, workflow.runtimeJson) 
                    : rawNodes;

                set({
                    nodes: hydratedNodes,
                    edges: workflow?.designJson?.edges || [],
                    workflowId: workflow?.id || null,
                    saveStatus: 'saved' // Prevent autosave when returning to latest version
                });
            } catch (error) {
                console.error("Failed to load latest version", error);
                toast.error(toUserMessage(error, "Failed to load latest version"));
            }
        }
    }
}));
